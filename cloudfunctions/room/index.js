// cloudfunctions/room/index.js
/**
 * 房间管理云函数
 * 
 * 提供房间相关的所有操作，包括：
 * 1. 获取房间列表
 * 2. 获取房间详情
 * 3. 创建房间
 * 4. 更新房间信息
 * 5. 删除房间
 * 6. 房间出租/退租操作
 */

const cloud = require('wx-server-sdk')

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 获取数据库引用
const db = cloud.database()
const _ = db.command

// 辅助函数：更新楼栋的updatedAt时间戳
async function updateBuildingTimestamp(buildingId) {
  if (!buildingId) return;
  try {
    await db.collection('buildings').doc(buildingId).update({
      data: {
        updatedAt: new Date()
      }
    });
    console.log(`楼栋 ${buildingId} 时间戳已更新`);
  } catch (e) {
    console.error(`更新楼栋 ${buildingId} 时间戳失败`, e);
  }
}


/**
 * 云函数主入口
 * @param {Object} event - 事件参数
 * @param {string} event.action - 操作类型
 * @param {Object} context - 云函数上下文
 */
exports.main = async (event, context) => {
  const { action, ...params } = event
  const { OPENID, APPID, UNIONID } = cloud.getWXContext()
  
  console.log('房间云函数调用', {
    action,
    params,
    openId: OPENID,
    timestamp: new Date().toISOString()
  })
  
  try {
    // 根据action分发到不同的处理函数
    switch (action) {
      case 'list':
        return await getRoomList(params, OPENID)
      case 'detail':
        return await getRoomDetail(params, OPENID)
      case 'create':
        return await createRoom(params, OPENID)
      case 'update':
        return await updateRoom(params, OPENID)
      case 'delete':
        return await deleteRoom(params, OPENID)
      case 'batchDelete':
        return await batchDeleteRooms(params, OPENID)
      case 'rent':
        return await rentRoom(params, OPENID)
      case 'checkout':
        return await checkoutRoom(params, OPENID)
      case 'updateStatus':
        return await updateRoomStatus(params, OPENID)
      case 'add':
        return await createRoom(params, OPENID)
      case 'batchCreate':
        return await batchCreateRooms(params, OPENID)
      case 'recordMeter':
        return await recordMeter(params, OPENID)
      case 'updateRegisterInfo':
        return await updateRegisterInfo(params, OPENID)
      case 'listByBuilding':
        return await listByBuilding(params, OPENID)
      case 'getUserInfo':
        return await getUserInfo(params, OPENID)
      case 'migrateFeeFields':
        return await migrateFeeFields(params, OPENID)
      default:
        return {
          code: 400,
          message: `未知的操作类型: ${action}`,
          data: null
        }
    }
  } catch (error) {
    console.error('房间云函数执行失败', {
      action,
      params,
      error: error.message,
      stack: error.stack
    })
    
    return {
      code: 500,
      message: '服务器内部错误',
      data: null,
      error: error.message
    }
  }
}

/**
 * 批量删除房间
 * @param {Object} params - 参数
 * @param {string[]} params.roomIds - 要删除的房间ID列表
 * @param {string} openId - 用户openId
 */
async function batchDeleteRooms(params, openId) {
  try {
    const { roomIds } = params;

    if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
      return {
        code: 400,
        message: '房间ID列表不能为空',
        data: null
      };
    }

    // 为安全起见，再次确认所有待删除房间都属于当前用户
    const roomsToDelete = await db.collection('rooms').where({
      _id: _.in(roomIds),
      landlordId: openId
    }).get();

    const validRoomIds = roomsToDelete.data.map(room => room._id);
    const buildingIds = [...new Set(roomsToDelete.data.map(room => room.buildingId).filter(id => id))];


    if (validRoomIds.length === 0) {
      return {
        code: 404,
        message: '没有找到可删除的房间',
        data: null
      };
    }

    // 软删除：标记为已删除
    const result = await db.collection('rooms').where({
      _id: _.in(validRoomIds)
    }).update({
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('房间批量删除成功', {
      deletedCount: result.stats.updated,
      roomIds: validRoomIds,
      landlordId: openId
    });
    
    // 异步更新所有相关楼栋的时间戳
    if (buildingIds.length > 0) {
      await Promise.all(buildingIds.map(id => updateBuildingTimestamp(id)));
    }


    return {
      code: 200,
      message: '批量删除成功',
      data: {
        deletedCount: result.stats.updated
      }
    };

  } catch (error) {
    console.error('批量删除房间失败', error);
    throw error;
  }
}


/**
 * 获取房间列表
 * @param {Object} params - 查询参数
 * @param {number} params.page - 页码
 * @param {number} params.pageSize - 每页数量
 * @param {string} params.keyword - 搜索关键词
 * @param {string} openId - 用户openId
 */
async function getRoomList(params, openId) {
  try {
    const { page = 1, pageSize = 20, keyword = '', buildingId = '' } = params
    const skip = (page - 1) * pageSize
    
    console.log('获取房间列表', { page, pageSize, keyword, buildingId, openId })
    
    // 构建查询条件
    let query = db.collection('rooms').where({
      landlordId: openId, // 只查询当前房东的房间
      isDeleted: false
    })

    // 如果传入buildingId，则增加筛选条件
    if (buildingId) {
      query = query.where({
        buildingId: buildingId
      })
    }
    
    // 如果有搜索关键词，添加搜索条件
    if (keyword) {
      // 注意：云数据库的模糊查询需要使用正则表达式
      query = query.where({
        roomName: db.RegExp({
          regexp: keyword,
          options: 'i'
        })
      })
    }
    
    // 获取总数（用于分页）
    const countResult = await query.count()
    const total = countResult.total
    
    // 获取数据
    const dataResult = await query
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    // 转换数据格式，保持与原API一致
    const roomList = dataResult.data.map(room => ({
      id: room._id,
      roomNumber: room.roomName,
      location: `${room.propertyName || ''}`,
      monthlyRent: room.monthlyRent || 0,
      status: room.status || 1, // 1-空置 2-已租
      tenantName: room.tenantName || '',
      tenantPhone: room.tenantPhone || '',
      contractStartDate: room.rentStartDate || '',
      contractEndDate: room.contractEndDate || '',
      lastMeterReadingDate: room.lastMeterReadingDate || '',
      createdAt: room.createdAt,
      updatedAt: room.updatedAt
    }))
    
    console.log('房间列表查询成功', {
      total,
      count: roomList.length,
      page,
      pageSize
    })
    
    return {
      code: 200,
      message: 'success',
      data: {
        list: roomList,
        total: total,
        page: page,
        pageSize: pageSize,
        hasMore: page * pageSize < total
      }
    }
    
  } catch (error) {
    console.error('获取房间列表失败', error)
    throw error
  }
}

/**
 * 获取房间详情
 * @param {Object} params - 参数
 * @param {string} params.roomId - 房间ID
 * @param {string} openId - 用户openId
 */
async function getRoomDetail(params, openId) {
  try {
    const { roomId } = params
    
    if (!roomId) {
      return {
        code: 400,
        message: '房间ID不能为空',
        data: null
      }
    }
    
    const result = await db.collection('rooms')
      .doc(roomId)
      .get()
    
    if (!result.data) {
      return {
        code: 404,
        message: '房间不存在',
        data: null
      }
    }
    
    const room = result.data
    
    console.log('🔍 数据库查询的原始房间数据:', {
      roomId: roomId,
      roomName: room.roomName,
      monthlyRent: room.monthlyRent,
      deposit: room.deposit,
      managementFee: room.managementFee,
      sanitationFee: room.sanitationFee,
      internetFee: room.internetFee,
      otherFee: room.otherFee,
      feeRemark: room.feeRemark
    })
    
    // 检查权限：只能查看自己的房间
    if (room.landlordId !== openId) {
      return {
        code: 403,
        message: '没有权限访问该房间',
        data: null
      }
    }
    
    // 转换数据格式
    const roomDetail = {
      id: room._id,
      buildingId: room.buildingId || '',
      buildingName: room.buildingName || '',
      roomNumber: room.roomName,
      location: room.propertyName || '',
      monthlyRent: room.monthlyRent || 0,
      deposit: room.deposit || 0,
      area: room.area || 0,
      floor: room.floor || 0,
      direction: room.direction || '',
      status: room.status || 1,
      tenantName: room.tenantName || '',
      tenantPhone: room.tenantPhone || '',
      tenantIdCard: room.tenantIdCard || '',
      rentStartDate: room.rentStartDate || '',
      contractStartDate: room.rentStartDate || '',
      contractEndDate: room.contractEndDate || '',
      waterPrice: room.waterPrice || 0,
      electricityPrice: room.electricityPrice || 0,
      lastWaterReading: room.lastWaterReading || 0,
      lastElectricityReading: room.lastElectricityReading || 0,
      lastMeterReadingDate: room.lastMeterReadingDate || '',
      // 新增费用字段（确保兼容旧数据）
      managementFee: room.managementFee !== undefined ? room.managementFee : 0,
      sanitationFee: room.sanitationFee !== undefined ? room.sanitationFee : 0,
      internetFee: room.internetFee !== undefined ? room.internetFee : 0,
      otherFee: room.otherFee !== undefined ? room.otherFee : 0,
      remarks: room.remarks || '',
      facilities: room.facilities || [],
      images: room.images || [],
      createdAt: room.createdAt,
      updatedAt: room.updatedAt
    }
    
    return {
      code: 200,
      message: 'success',
      data: roomDetail
    }
    
  } catch (error) {
    console.error('获取房间详情失败', error)
    throw error
  }
}

/**
 * 创建房间
 * @param {Object} params - 房间信息
 * @param {string} openId - 用户openId
 */
async function createRoom(params, openId) {
  try {
    // 支持两种参数格式：直接参数或包含 roomData 的格式
    const roomData = params.roomData || params
    const {
      roomNumber,
      location,
      address, // 兼容 address 字段
      monthlyRent,
      rent, // 兼容 rent 字段
      deposit,
      area,
      facilities,
      description,
      images,
      waterPrice,
      electricityPrice,
      buildingId,
    } = roomData
    
    // 参数验证
    if (!roomNumber) {
      return {
        code: 400,
        message: '房间编号不能为空',
        data: null
      }
    }
    
    // 检查房间编号是否重复
    const existRoom = await db.collection('rooms')
      .where({
        landlordId: openId,
        roomName: roomNumber,
        isDeleted: false
      })
      .get()
    
    if (existRoom.data.length > 0) {
      return {
        code: 400,
        message: '房间编号已存在',
        data: null
      }
    }
    
    // 构建房间数据（支持新的简化结构）
    const newRoomData = {
      landlordId: openId,
      buildingId: buildingId || '',
      buildingName: roomData.buildingName || '',
      roomName: roomNumber,
      propertyName: location || address || '',
      area: parseFloat(area) || 0,
      floor: parseInt(roomData.floor) || Math.floor(parseInt(roomNumber) / 100) || 1,
      direction: roomData.direction || '南向',
      decoration: roomData.decoration || '简装',
      monthlyRent: parseFloat(roomData.feeStandard?.monthlyRent) || 0,
      deposit: parseFloat(roomData.feeStandard?.deposit) || 0,
      electricityPrice: parseFloat(roomData.feeStandard?.electricityPrice) || 0.8,
      waterPrice: parseFloat(roomData.feeStandard?.waterPrice) || 4.5,
      internetFee: parseFloat(roomData.feeStandard?.internetFee) || 0,
      sanitationFee: parseFloat(roomData.feeStandard?.sanitationFee) || 0,
      managementFee: parseFloat(roomData.feeStandard?.managementFee) || 0,
      otherFee: parseFloat(roomData.feeStandard?.otherFee) || 0,
      feeRemark: roomData.feeStandard?.feeRemark || '',
      lastWaterReading: 0,
      lastElectricityReading: 0,
      facilities: roomData.facilities || {},
      remark: roomData.remarks || '',
      images: roomData.images || [],
      status: 1, // 默认空置状态
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const result = await db.collection('rooms').add({
      data: newRoomData
    })
    
    console.log('房间创建成功', {
      roomId: result._id,
      roomNumber,
      landlordId: openId
    })
    
    // 更新楼栋时间戳
    await updateBuildingTimestamp(buildingId);

    return {
      code: 200,
      message: '房间创建成功',
      data: {
        id: result._id,
        ...newRoomData
      }
    }
    
  } catch (error) {
    console.error('创建房间失败', error)
    throw error
  }
}

/**
 * 更新房间信息
 * @param {Object} params - 更新参数
 * @param {string} openId - 用户openId
 */
async function updateRoom(params, openId) {
  try {
    const { roomId, roomData } = params
    
    if (!roomId) {
      return { code: 400, message: '房间ID不能为空' };
    }
    
    const room = await db.collection('rooms').doc(roomId).get();
    
    if (!room.data) {
      return { code: 404, message: '房间不存在' };
    }
    
    if (room.data.landlordId !== openId) {
      return { code: 403, message: '没有权限修改该房间' };
    }
    
    // 构建更新数据
    const updateFields = {
      updatedAt: new Date(),
      roomName: roomData.roomNumber,
      remarks: roomData.remarks,
      // 直接更新整个费用对象
      monthlyRent: roomData.feeStandard.monthlyRent,
      deposit: roomData.feeStandard.deposit || 0,
      electricityPrice: roomData.feeStandard.electricityPrice,
      waterPrice: roomData.feeStandard.waterPrice,
      internetFee: roomData.feeStandard.internetFee,
      sanitationFee: roomData.feeStandard.sanitationFee,
      managementFee: roomData.feeStandard.managementFee,
      otherFee: roomData.feeStandard.otherFee,
      feeRemark: roomData.feeStandard.feeRemark || '',
    };
    
    const result = await db.collection('rooms').doc(roomId).update({
      data: updateFields
    });
    
    console.log('房间更新成功', { roomId, updateFields, landlordId: openId });
    
    // 更新楼栋时间戳
    await updateBuildingTimestamp(room.data.buildingId);

    return {
      code: 200,
      message: '房间更新成功',
      data: { id: roomId, updated: result.stats.updated }
    };
    
  } catch (error) {
    console.error('更新房间失败', error);
    throw error;
  }
}

/**
 * 删除房间
 * @param {Object} params - 参数
 * @param {string} openId - 用户openId
 */
async function deleteRoom(params, openId) {
  try {
    const { roomId } = params
    
    if (!roomId) {
      return {
        code: 400,
        message: '房间ID不能为空',
        data: null
      }
    }
    
    // 检查房间是否存在且属于当前用户
    const room = await db.collection('rooms').doc(roomId).get()
    
    if (!room.data) {
      return {
        code: 404,
        message: '房间不存在',
        data: null
      }
    }
    
    if (room.data.landlordId !== openId) {
      return {
        code: 403,
        message: '没有权限删除该房间',
        data: null
      }
    }
    
    // 检查房间是否有租客
    if (room.data.status === 2) {
      return {
        code: 400,
        message: '房间有租客，无法删除',
        data: null
      }
    }
    
    // 软删除：标记为已删除而不是物理删除
    const result = await db.collection('rooms').doc(roomId).update({
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date()
      }
    })
    
    console.log('房间删除成功', {
      roomId,
      landlordId: openId
    })
    
    // 更新楼栋时间戳
    await updateBuildingTimestamp(room.data.buildingId);

    return {
      code: 200,
      message: '房间删除成功',
      data: {
        id: roomId,
        deleted: true
      }
    }
    
  } catch (error) {
    console.error('删除房间失败', error)
    throw error
  }
}

/**
 * 房间出租
 * @param {Object} params - 出租参数
 * @param {string} openId - 用户openId
 */
async function rentRoom(params, openId) {
  try {
    const {
      roomId,
      tenantName,
      tenantPhone,
      tenantIdCard,
      contractStartDate,
      contractEndDate,
      monthlyRent,
      deposit,
      remark,
      lastWaterReading,
      lastElectricityReading,
      meterDate
    } = params
    
    // 参数验证 - 至少需要房间ID和租客姓名或电话之一
    if (!roomId) {
      return {
        code: 400,
        message: '房间ID不能为空',
        data: null
      }
    }
    
    // 租客信息现在是完全可选的，不再强制要求
    
    // 检查房间状态
    const room = await db.collection('rooms').doc(roomId).get()
    
    if (!room.data) {
      return {
        code: 404,
        message: '房间不存在',
        data: null
      }
    }
    
    if (room.data.landlordId !== openId) {
      return {
        code: 403,
        message: '没有权限操作该房间',
        data: null
      }
    }
    
    if (room.data.status !== 1) {
      return {
        code: 400,
        message: '房间当前状态不允许出租',
        data: null
      }
    }
    
    // 准备更新数据
    const updateData = {
      status: 2, // 已租状态
      tenantName: tenantName || '',
      tenantPhone: tenantPhone || '',
      tenantIdCard: tenantIdCard || '',
      rentStartDate: contractStartDate || '', // 入住日期可为空
      contractEndDate: contractEndDate || '',
      monthlyRent: monthlyRent || room.data.monthlyRent,
      deposit: deposit || room.data.deposit,
      remark: remark || '',
      rentDueDay: params.rentDueDay || room.data.rentDueDay || null,
      sanitationFee: params.sanitationFee !== undefined ? params.sanitationFee : room.data.sanitationFee || 0,
      managementFee: params.managementFee !== undefined ? params.managementFee : room.data.managementFee || 0,
      otherFee: params.otherFee !== undefined ? params.otherFee : room.data.otherFee || 0,
      internetFee: params.internetFee !== undefined ? params.internetFee : room.data.internetFee || 0,
      updatedAt: new Date()
    }
    
    // 如果提供了表读数，同时更新
    if (lastWaterReading !== null && lastWaterReading !== undefined) {
      updateData.lastWaterReading = lastWaterReading
    }
    if (lastElectricityReading !== null && lastElectricityReading !== undefined) {
      updateData.lastElectricityReading = lastElectricityReading
    }
    if (meterDate) {
      updateData.lastMeterReadingDate = meterDate
    }

    // 更新房间信息
    const result = await db.collection('rooms').doc(roomId).update({
      data: updateData
    })

    const hasWaterReading = lastWaterReading !== null && lastWaterReading !== undefined
    const hasElectricityReading = lastElectricityReading !== null && lastElectricityReading !== undefined
    if (hasWaterReading || hasElectricityReading) {
      let meterTime = meterDate ? new Date(meterDate) : new Date()
      if (isNaN(meterTime.getTime())) {
        meterTime = new Date()
      }
      const readingMonth = `${meterTime.getFullYear()}-${String(meterTime.getMonth() + 1).padStart(2, '0')}`
      const meterBase = {
        roomId,
        landlordId: openId,
        readingMonth,
        recordDate: meterDate || meterTime,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const meterRecords = []

      if (hasWaterReading) {
        const prevWaterReading = room.data.lastWaterReading || 0
        const waterValue = parseFloat(lastWaterReading)
        meterRecords.push({
          ...meterBase,
          meterType: 'water',
          waterReading: waterValue,
          prevWaterReading: prevWaterReading,
          waterUsage: Math.max(0, waterValue - prevWaterReading),
          isBilled: true // 初始化读数视为已开单
        })
      }

      if (hasElectricityReading) {
        const prevElectricityReading = room.data.lastElectricityReading || 0
        const electricityValue = parseFloat(lastElectricityReading)
        meterRecords.push({
          ...meterBase,
          meterType: 'electricity',
          electricityReading: electricityValue,
          prevElectricityReading: prevElectricityReading,
          electricityUsage: Math.max(0, electricityValue - prevElectricityReading),
          isBilled: true // 初始化读数视为已开单
        })
      }

      if (meterRecords.length > 0) {
        await Promise.all(meterRecords.map(data => db.collection('meter').add({ data })))
      }
    }
    
    console.log('房间出租成功', {
      roomId,
      tenantName,
      tenantPhone,
      landlordId: openId,
      lastWaterReading,
      lastElectricityReading,
      meterDate
    })
    
    // 更新楼栋时间戳
    await updateBuildingTimestamp(room.data.buildingId);

    return {
      code: 200,
      message: '房间出租成功',
      data: {
        id: roomId,
        rented: true
      }
    }
    
  } catch (error) {
    console.error('房间出租失败', error)
    throw error
  }
}

/**
 * 房间退租
 * @param {Object} params - 退租参数
 * @param {string} openId - 用户openId
 */
async function checkoutRoom(params, openId) {
  try {
    const { roomId, checkoutDate, finalWaterReading, finalElectricityReading, meterDate } = params
    
    if (!roomId) {
      return {
        code: 400,
        message: '房间ID不能为空',
        data: null
      }
    }
    
    // 检查房间状态
    const room = await db.collection('rooms').doc(roomId).get()
    
    if (!room.data) {
      return {
        code: 404,
        message: '房间不存在',
        data: null
      }
    }
    
    if (room.data.landlordId !== openId) {
      return {
        code: 403,
        message: '没有权限操作该房间',
        data: null
      }
    }
    
    if (room.data.status !== 2) {
      return {
        code: 400,
        message: '房间当前状态不允许退租',
        data: null
      }
    }
    
    // 更新房间状态及最终读数
    const updateFields = {
      status: 1, // 空置状态
      tenantName: '',
      tenantPhone: '',
      tenantIdCard: '',
      rentStartDate: '',
      contractEndDate: '',
      checkoutDate: checkoutDate || new Date(),
      updatedAt: new Date()
    }

    if (finalWaterReading !== undefined && finalWaterReading !== null) {
      updateFields.lastWaterReading = finalWaterReading
    }
    if (finalElectricityReading !== undefined && finalElectricityReading !== null) {
      updateFields.lastElectricityReading = finalElectricityReading
    }
    if (meterDate) {
      updateFields.lastMeterReadingDate = meterDate
    }

    const result = await db.collection('rooms').doc(roomId).update({
      data: updateFields
    })
    
    console.log('房间退租成功', {
      roomId,
      checkoutDate,
      landlordId: openId
    })
    
    // 更新楼栋时间戳
    await updateBuildingTimestamp(room.data.buildingId);

    return {
      code: 200,
      message: '房间退租成功',
      data: {
        id: roomId,
        checkedOut: true
      }
    }
    
  } catch (error) {
    console.error('房间退租失败', error)
    throw error
  }
}

/**
 * 更新房间状态
 * @param {Object} params - 参数
 * @param {string} openId - 用户openId
 */
async function updateRoomStatus(params, openId) {
  try {
    const { roomId, status } = params
    
    if (!roomId || status === undefined) {
      return {
        code: 400,
        message: '参数不完整',
        data: null
      }
    }
    
    // 验证状态值
    if (![1, 2].includes(status)) {
      return {
        code: 400,
        message: '无效的状态值',
        data: null
      }
    }
    
    // 检查房间权限
    const room = await db.collection('rooms').doc(roomId).get()
    
    if (!room.data) {
      return {
        code: 404,
        message: '房间不存在',
        data: null
      }
    }
    
    if (room.data.landlordId !== openId) {
      return {
        code: 403,
        message: '没有权限操作该房间',
        data: null
      }
    }
    
    // 更新状态
    const result = await db.collection('rooms').doc(roomId).update({
      data: {
        status,
        updatedAt: new Date()
      }
    })
    
    console.log('房间状态更新成功', {
      roomId,
      status,
      landlordId: openId
    })
    
    // 更新楼栋时间戳
    await updateBuildingTimestamp(room.data.buildingId);

    return {
      code: 200,
      message: '房间状态更新成功',
      data: {
        id: roomId,
        status
      }
    }
    
  } catch (error) {
    console.error('更新房间状态失败', error)
    throw error
  }
}

/**
 * 批量创建房间
 * @param {Object} params - 参数
 * @param {Array} params.roomList - 房间列表
 * @param {string} openId - 用户openId
 */
async function batchCreateRooms(params, openId) {
  try {
    const { roomList } = params
    
    if (!roomList || !Array.isArray(roomList) || roomList.length === 0) {
      return {
        code: 400,
        message: '房间列表不能为空',
        data: null
      }
    }
    
    console.log('批量创建房间', {
      count: roomList.length,
      landlordId: openId
    })
    
    const createdRooms = []
    const failedRooms = []
    
    // 批量处理房间创建
    for (let i = 0; i < roomList.length; i++) {
      const roomData = roomList[i]
      
      try {
        // 检查房间号是否重复
        const existRoom = await db.collection('rooms')
          .where({
            landlordId: openId,
            buildingId: roomData.buildingId,
            roomName: roomData.roomNumber,
            isDeleted: false
          })
          .get()
        
        if (existRoom.data.length > 0) {
          failedRooms.push({
            roomNumber: roomData.roomNumber,
            error: '房间号已存在'
          })
          continue
        }
        
        // 构建房间数据（简化版）
        const newRoomData = {
          landlordId: openId,
          buildingId: roomData.buildingId || '',
          buildingName: roomData.buildingName || '',
          roomName: roomData.roomNumber,
          area: parseFloat(roomData.area) || 0,
          floor: parseInt(roomData.floor) || 1,
          direction: roomData.direction || '南向',
          decoration: roomData.decoration || '简装',
          monthlyRent: parseFloat(roomData.feeStandard?.monthlyRent) || 0,
          deposit: parseFloat(roomData.feeStandard?.deposit) || 0,
          electricityPrice: parseFloat(roomData.feeStandard?.electricityPrice) || 0.8,
          waterPrice: parseFloat(roomData.feeStandard?.waterPrice) || 4.5,
          internetFee: parseFloat(roomData.feeStandard?.internetFee) || 0,
          sanitationFee: parseFloat(roomData.feeStandard?.sanitationFee) || parseFloat(roomData.feeStandard?.cleaningFee) || 0,
          managementFee: parseFloat(roomData.feeStandard?.managementFee) || 0,
          otherFee: parseFloat(roomData.feeStandard?.otherFee) || 0,
          feeRemark: roomData.feeStandard?.feeRemark || '',
          lastWaterReading: 0,
          lastElectricityReading: 0,
          facilities: roomData.facilities || {},
          remark: roomData.remarks || '',
          images: roomData.images || [],
          status: 1, // 默认空置状态
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
        
        const result = await db.collection('rooms').add({
          data: newRoomData
        })
        
        createdRooms.push({
          id: result._id,
          roomNumber: roomData.roomNumber,
          ...newRoomData
        })
        
      } catch (error) {
        console.error(`创建房间${roomData.roomNumber}失败:`, error)
        failedRooms.push({
          roomNumber: roomData.roomNumber,
          error: error.message
        })
      }
    }
    
    // 更新楼栋房间数量和时间戳
    if (createdRooms.length > 0 && roomList[0].buildingId) {
      const buildingId = roomList[0].buildingId
      try {
        const roomCount = await db.collection('rooms')
          .where({
            buildingId: buildingId,
            isDeleted: false
          })
          .count()
        
        await db.collection('buildings').doc(buildingId).update({
          data: {
            roomCount: roomCount.total,
            updatedAt: new Date()
          }
        })
      } catch (error) {
        console.error('更新楼栋房间数量失败:', error)
      }
    }
    
    console.log('批量创建房间完成', {
      success: createdRooms.length,
      failed: failedRooms.length,
      landlordId: openId
    })
    
    return {
      code: 200,
      message: `批量创建完成，成功${createdRooms.length}间，失败${failedRooms.length}间`,
      data: {
        success: createdRooms,
        failed: failedRooms,
        successCount: createdRooms.length,
        failedCount: failedRooms.length
      }
    }
    
  } catch (error) {
    console.error('批量创建房间失败', error)
    throw error
  }
}

/**
 * 获取用户信息
 * @param {Object} params - 参数
 * @param {string} openId - 用户openId
 */
async function getUserInfo(params, openId) {
  try {
    const { APPID, UNIONID } = cloud.getWXContext()
    
    return {
      code: 200,
      message: 'success',
      data: {
        openId: openId,
        appId: APPID,
        unionId: UNIONID,
        timestamp: new Date().toISOString(),
        env: cloud.DYNAMIC_CURRENT_ENV
      }
    }
    
  } catch (error) {
    console.error('获取用户信息失败', error)
    throw error
  }
}

/**
 * 记录电表水表读数
 * @param {Object} params - 参数
 * @param {string} params.roomId - 房间ID
 * @param {number} params.waterReading - 水表读数
 * @param {number} params.electricityReading - 电表读数
 * @param {string} openId - 用户openId
 */
async function recordMeter(params, openId) {
  try {
    const { roomId, waterReading, electricityReading, meterDate } = params;

    const hasWater = waterReading !== undefined && waterReading !== null
    const hasElectricity = electricityReading !== undefined && electricityReading !== null

    if (!roomId || (!hasWater && !hasElectricity)) {
      return { code: 400, message: '参数不完整' };
    }

    const room = await db.collection('rooms').doc(roomId).get();

    if (!room.data) {
      return { code: 404, message: '房间不存在' };
    }
    if (room.data.landlordId !== openId) {
      return { code: 403, message: '没有权限操作该房间' };
    }

    const updateFields = {
      updatedAt: new Date()
    };

    if (hasWater) {
      const waterValue = parseFloat(waterReading)
      if (isNaN(waterValue)) {
        return { code: 400, message: '水表读数无效' }
      }
      updateFields.lastWaterReading = waterValue
    }

    if (hasElectricity) {
      const elecValue = parseFloat(electricityReading)
      if (isNaN(elecValue)) {
        return { code: 400, message: '电表读数无效' }
      }
      updateFields.lastElectricityReading = elecValue
    }

    if (hasWater || hasElectricity) {
      updateFields.lastMeterReadingDate = meterDate || new Date()
    }

    await db.collection('rooms').doc(roomId).update({
      data: updateFields
    });

    if (hasWater || hasElectricity) {
      let meterTime = meterDate ? new Date(meterDate) : new Date()
      if (isNaN(meterTime.getTime())) {
        meterTime = new Date()
      }
      const readingMonth = `${meterTime.getFullYear()}-${String(meterTime.getMonth() + 1).padStart(2, '0')}`
      const meterBase = {
        roomId,
        landlordId: openId,
        readingMonth,
        recordDate: meterDate || meterTime,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const meterRecords = []
      if (hasWater) {
        const prevWaterReading = room.data.lastWaterReading || 0
        meterRecords.push({
          ...meterBase,
          meterType: 'water',
          waterReading: updateFields.lastWaterReading,
          prevWaterReading,
          waterUsage: Math.max(0, updateFields.lastWaterReading - prevWaterReading),
          isBilled: true // 初始化读数视为已开单
        })
      }

      if (hasElectricity) {
        const prevElectricityReading = room.data.lastElectricityReading || 0
        meterRecords.push({
          ...meterBase,
          meterType: 'electricity',
          electricityReading: updateFields.lastElectricityReading,
          prevElectricityReading,
          electricityUsage: Math.max(0, updateFields.lastElectricityReading - prevElectricityReading),
          isBilled: true // 初始化读数视为已开单
        })
      }

      if (meterRecords.length > 0) {
        await Promise.all(meterRecords.map(data => db.collection('meter').add({ data })))
      }
    }

    await updateBuildingTimestamp(room.data.buildingId);

    return {
      code: 200,
      message: '抄表记录成功',
      data: { id: roomId, ...updateFields }
    };

  } catch (error) {
    console.error('记录抄表失败', error);
    throw error;
  }
}

/**
 * 更新登记信息
 * @param {Object} params - 参数
 * @param {string} openId - 用户openId
 */
async function updateRegisterInfo(params, openId) {
  try {
    const {
      roomId,
      tenantName,
      tenantPhone,
      lastWaterReading,
      lastElectricityReading,
      meterDate
    } = params
    
    if (!roomId) {
      return {
        code: 400,
        message: '房间ID不能为空',
        data: null
      }
    }
    
    // 检查房间是否存在且有权限
    const room = await db.collection('rooms').doc(roomId).get()
    
    if (!room.data) {
      return {
        code: 404,
        message: '房间不存在',
        data: null
      }
    }
    
    if (room.data.landlordId !== openId) {
      return {
        code: 403,
        message: '没有权限操作该房间',
        data: null
      }
    }
    
    // 准备更新数据
    const updateData = {
      updatedAt: new Date()
    }
    
    // 更新租客信息
    if (tenantName !== null) {
      updateData.tenantName = tenantName
    }
    if (tenantPhone !== null) {
      updateData.tenantPhone = tenantPhone
    }
    
    // 更新表读数
    if (lastWaterReading !== null && lastWaterReading !== undefined) {
      updateData.lastWaterReading = lastWaterReading
    }
    if (lastElectricityReading !== null && lastElectricityReading !== undefined) {
      updateData.lastElectricityReading = lastElectricityReading
    }
    if (meterDate) {
      updateData.lastMeterReadingDate = meterDate
    }
    
    // 更新房间信息
    await db.collection('rooms').doc(roomId).update({
      data: updateData
    })

    const hasWaterReading = lastWaterReading !== null && lastWaterReading !== undefined
    const hasElectricityReading = lastElectricityReading !== null && lastElectricityReading !== undefined
    if (hasWaterReading || hasElectricityReading) {
      let meterTime = meterDate ? new Date(meterDate) : new Date()
      if (isNaN(meterTime.getTime())) {
        meterTime = new Date()
      }
      const readingMonth = `${meterTime.getFullYear()}-${String(meterTime.getMonth() + 1).padStart(2, '0')}`
      const meterBase = {
        roomId,
        landlordId: openId,
        readingMonth,
        recordDate: meterDate || meterTime,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const meterRecords = []

      if (hasWaterReading) {
        const prevWaterReading = room.data.lastWaterReading || 0
        const waterValue = parseFloat(lastWaterReading)
        meterRecords.push({
          ...meterBase,
          meterType: 'water',
          waterReading: waterValue,
          prevWaterReading,
          waterUsage: Math.max(0, waterValue - prevWaterReading),
          isBilled: true // 初始化读数视为已开单
        })
      }

      if (hasElectricityReading) {
        const prevElectricityReading = room.data.lastElectricityReading || 0
        const electricityValue = parseFloat(lastElectricityReading)
        meterRecords.push({
          ...meterBase,
          meterType: 'electricity',
          electricityReading: electricityValue,
          prevElectricityReading,
          electricityUsage: Math.max(0, electricityValue - prevElectricityReading),
          isBilled: true // 初始化读数视为已开单
        })
      }

      if (meterRecords.length > 0) {
        await Promise.all(meterRecords.map(data => db.collection('meter').add({ data })))
      }
    }
    
    console.log('更新登记信息成功', {
      roomId,
      updateData,
      landlordId: openId
    })
    
    // 更新楼栋时间戳
    await updateBuildingTimestamp(room.data.buildingId)
    
    return {
      code: 200,
      message: '更新成功',
      data: {
        id: roomId,
        updated: true
      }
    }
    
  } catch (error) {
    console.error('更新登记信息失败', error)
    throw error
  }
}

/**
 * 根据楼栋ID获取房间列表
 * @param {Object} params - 参数
 * @param {string} openId - 用户openId
 */
async function listByBuilding(params, openId) {
  try {
    const { buildingId, status } = params
    
    if (!buildingId) {
      return {
        code: 400,
        message: '楼栋ID不能为空',
        data: null
      }
    }
    
    // 获取楼栋信息
    const building = await db.collection('buildings').doc(buildingId).get()
    
    if (!building.data) {
      return {
        code: 404,
        message: '楼栋不存在',
        data: null
      }
    }
    
    if (building.data.landlordId !== openId) {
      return {
        code: 403,
        message: '没有权限访问该楼栋',
        data: null
      }
    }
    
    // 构建查询条件
    const whereConditions = {
      buildingId: buildingId,
      landlordId: openId,
      isDeleted: false
    }
    
    // 如果指定了状态，添加状态过滤
    if (status !== undefined && status !== null) {
      whereConditions.status = status
    }
    
    let query = db.collection('rooms').where(whereConditions)
    
    // 查询房间列表
    const rooms = await query.orderBy('roomName', 'asc').get()
    
    // 转换数据格式，确保roomNumber字段正确
    const roomList = rooms.data.map(room => ({
      ...room,
      roomNumber: room.roomName // 映射roomName到roomNumber字段
    }))
    
    console.log('获取楼栋房间列表成功', {
      buildingId,
      status,
      count: roomList.length,
      landlordId: openId
    })
    
    return {
      code: 200,
      message: '获取房间列表成功',
      data: {
        building: building.data,
        rooms: roomList
      }
    }
    
  } catch (error) {
    console.error('根据楼栋获取房间列表失败', error)
    throw error
  }
}

/**
 * 迁移费用字段 - 为现有房间添加缺失的费用字段
 * @param {Object} params - 参数
 * @param {string} openId - 用户openId
 */
async function migrateFeeFields(params, openId) {
  try {
    console.log('开始迁移费用字段...')
    
    // 查询当前用户的所有房间
    const rooms = await db.collection('rooms').where({
      landlordId: openId,
      isDeleted: false
    }).get()
    
    console.log(`找到 ${rooms.data.length} 间房间需要检查`)
    
    let updatedCount = 0
    
    for (const room of rooms.data) {
      // 检查是否缺少费用字段
      const needsUpdate = 
        room.managementFee === undefined ||
        room.sanitationFee === undefined ||
        room.internetFee === undefined ||
        room.otherFee === undefined ||
        room.feeRemark === undefined ||
        room.deposit === undefined
      
      if (needsUpdate) {
        console.log(`更新房间 ${room.roomName} 的费用字段`)
        
        const updateData = {
          updatedAt: new Date()
        }
        
        // 只更新缺失的字段
        if (room.managementFee === undefined) updateData.managementFee = 0
        if (room.sanitationFee === undefined) updateData.sanitationFee = 0
        if (room.internetFee === undefined) updateData.internetFee = 0
        if (room.otherFee === undefined) updateData.otherFee = 0
        if (room.feeRemark === undefined) updateData.feeRemark = ''
        if (room.deposit === undefined) updateData.deposit = 0
        
        await db.collection('rooms').doc(room._id).update({
          data: updateData
        })
        
        updatedCount++
      }
    }
    
    console.log(`费用字段迁移完成，共更新 ${updatedCount} 间房间`)
    
    return {
      code: 200,
      message: '费用字段迁移完成',
      data: {
        totalRooms: rooms.data.length,
        updatedRooms: updatedCount
      }
    }
    
  } catch (error) {
    console.error('迁移费用字段失败', error)
    throw error
  }
}
