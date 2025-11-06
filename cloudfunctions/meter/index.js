// cloudfunctions/meter/index.js
/**
 * 抄表管理云函数
 * 
 * 提供抄表相关的所有操作，包括：
 * 1. 批量抄表记录
 * 2. 单个房间抄表更新
 * 3. 获取抄表历史
 * 4. 生成账单
 */

const cloud = require('wx-server-sdk')

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 获取数据库引用
const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

/**
 * 云函数主入口
 * @param {Object} event - 事件参数
 * @param {string} event.action - 操作类型
 * @param {Object} context - 云函数上下文
 */
exports.main = async (event, context) => {
  const { action, ...params } = event
  const { OPENID } = cloud.getWXContext()
  
  console.log('抄表云函数调用', {
    action,
    params,
    openId: OPENID,
    timestamp: new Date().toISOString()
  })
  
  try {
    switch (action) {
      case 'getRoomsForBatchMeter': // 新增：专为批量抄表页面设计的函数
        return await getRoomsForBatchMeter(params, OPENID)
      case 'batchRecord':
        return await batchRecordMeter(params, OPENID)
      case 'submitMeterReading':
        return await submitMeterReading(params, OPENID)
      case 'updateSingle':
        return await updateSingleMeter(params, OPENID)
      case 'getHistory':
        return await getMeterHistory(params, OPENID)
      case 'generateBill':
        return await generateBillFromMeter(params, OPENID)
      case 'getRoomMeterData':
        return await getRoomMeterData(params, OPENID)
      case 'getLastMonthReadings':
        return await getLastMonthReadings(params, OPENID)
      case 'batchGenerateBills':
        return await batchGenerateBills(params, OPENID)
      default:
        return {
          code: 400,
          message: `未知的操作类型: ${action}`,
          data: null
        }
    }
  } catch (error) {
    console.error('抄表云函数执行失败', {
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
 * [新增] 为批量抄表页面获取房间及抄表数据
 * 1. 获取指定楼栋的所有房间
 * 2. 聚合查询，关联查询当月和上月的抄表记录
 * 3. 组装数据，返回给前端
 * @param {Object} params - 参数
 * @param {string} params.buildingId - 楼栋ID
 * @param {string} params.currentMonth - 当前抄表月份 (YYYY-MM)
 * @param {string} params.previousMonth - 上一月份 (YYYY-MM)
 * @param {string} openId - 用户openId
 */
async function getRoomsForBatchMeter(params, openId) {
  try {
    const { buildingId, currentMonth, previousMonth } = params;

    if (!buildingId || !currentMonth || !previousMonth) {
      return { code: 400, message: '参数不完整' };
    }

    // 1. 获取楼栋下的所有已出租房间
    const roomsResult = await db.collection('rooms').where({
      buildingId: buildingId,
      landlordId: openId,
      isDeleted: false,
      status: 2 // 只查询已出租的房间
    }).get();

    if (!roomsResult.data || roomsResult.data.length === 0) {
      return { code: 200, message: '该楼栋下无房间', data: [] };
    }

    const rooms = roomsResult.data;
    const roomIds = rooms.map(r => r._id);

    // 2. 一次性查询所有相关月份的抄表记录
    const meterReadings = await db.collection('meter').where({
      roomId: _.in(roomIds),
      readingMonth: _.in([currentMonth, previousMonth]),
      landlordId: openId
    }).get();

    const readingsMap = {};
    meterReadings.data.forEach(reading => {
      if (!readingsMap[reading.roomId]) {
        readingsMap[reading.roomId] = {};
      }
      readingsMap[reading.roomId][reading.readingMonth] = reading;
    });

    // 3. 组装数据
    const finalRoomData = rooms.map(room => {
      const currentReading = readingsMap[room._id] ? readingsMap[room._id][currentMonth] : null;
      const previousReading = readingsMap[room._id] ? readingsMap[room._id][previousMonth] : null;

      // 上次读数来源：优先上月抄表，其次是房间的初始值
      const lastWaterReading = previousReading ? previousReading.waterReading : (room.lastWaterReading || 0);
      const lastElectricityReading = previousReading ? previousReading.electricityReading : (room.lastElectricityReading || 0);

      return {
        ...room,
        // 当前月抄表信息
        currentMeterReading: {
          water: currentReading ? currentReading.waterReading : '',
          electricity: currentReading ? currentReading.electricityReading : '',
        },
        // 上次读数
        lastMeterReading: {
          water: lastWaterReading,
          electricity: lastElectricityReading,
        },
        // 新增：时间信息（用于显示“最后抄表时间”）
        currentMeterTime: currentReading ? (currentReading.updatedAt || currentReading.createdAt || null) : null,
        // 若上期记录缺失，回退到房间维度的 lastMeterReadingDate（若存在）
        previousMeterTime: previousReading 
          ? (previousReading.updatedAt || previousReading.createdAt || null)
          : (room.lastMeterReadingDate || null),
        isMetered: !!currentReading, // 是否已抄表
      };
    });
    
    // 按房间名排序
    finalRoomData.sort((a, b) => {
      const numA = parseInt(a.roomName.replace(/[^0-9]/ig, ""));
      const numB = parseInt(b.roomName.replace(/[^0-9]/ig, ""));
      if (numA !== numB) {
        return numA - numB;
      }
      return a.roomName.localeCompare(b.roomName, 'zh-Hans-CN');
    });

    return {
      code: 200,
      message: 'success',
      data: finalRoomData
    };

  } catch (error) {
    console.error('getRoomsForBatchMeter 失败', error);
    throw error;
  }
}


/**
 * 批量抄表记录
 * @param {Object} params - 参数
 * @param {Array} params.meterReadings - 抄表数据列表
 * @param {string} openId - 用户openId
 */
async function batchRecordMeter(params, openId) {
  try {
    const { meterReadings, recordDate } = params
    
    if (!meterReadings || !Array.isArray(meterReadings)) {
      return { code: 400, message: '抄表数据不能为空' }
    }
    
    const results = []
    const errors = []
    
    // 批量处理抄表记录
    for (const reading of meterReadings) {
      try {
        const result = await submitMeterReading({
          ...reading,
          recordDate
        }, openId)
        
        if (result.code === 200) {
          results.push(result.data)
        } else {
          errors.push({
            roomId: reading.roomId,
            error: result.message
          })
        }
      } catch (error) {
        errors.push({
          roomId: reading.roomId,
          error: error.message
        })
      }
    }
    
    return {
      code: 200,
      message: `批量抄表完成，成功${results.length}条，失败${errors.length}条`,
      data: {
        success: results,
        errors: errors,
        successCount: results.length,
        errorCount: errors.length
      }
    }
    
  } catch (error) {
    console.error('批量抄表记录失败', error)
    throw error
  }
}

/**
 * 提交单个房间抄表记录
 * @param {Object} params - 参数
 * @param {string} params.roomId - 房间ID
 * @param {number} params.waterReading - 水表读数
 * @param {number} params.electricityReading - 电表读数
 * @param {string} params.year - 年份
 * @param {string} params.month - 月份
 * @param {string} openId - 用户openId
 */
async function submitMeterReading(params, openId) {
  try {
    const {
      roomId,
      year,
      month,
      waterReading,
      electricityReading,
      images = []
    } = params;

    if (!roomId || !year || !month) {
      return { code: 400, message: '参数不完整' };
    }
    if (waterReading === undefined && electricityReading === undefined) {
      return { code: 400, message: '至少需要一个读数' };
    }

    const room = await db.collection('rooms').doc(roomId).get();
    if (!room.data || room.data.landlordId !== openId) {
      return { code: 403, message: '没有权限操作该房间' };
    }

    const readingMonth = `${year}-${String(month).padStart(2, '0')}`;
    const lastMonthDate = new Date(year, month - 2, 1);
    const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const lastMeterRecord = await db.collection('meter').where({
      roomId: roomId,
      readingMonth: lastMonthStr,
      landlordId: openId
    }).get();

    const prevWaterReading = lastMeterRecord.data.length > 0 ? lastMeterRecord.data[0].waterReading : (room.data.lastWaterReading || 0);
    const prevElectricityReading = lastMeterRecord.data.length > 0 ? lastMeterRecord.data[0].electricityReading : (room.data.lastElectricityReading || 0);

    const existingRecordResult = await db.collection('meter').where({
      roomId: roomId,
      readingMonth: readingMonth
    }).get();

    const existingRecord = existingRecordResult.data.length > 0 ? existingRecordResult.data[0] : {};

    const meterData = {
      ...existingRecord,
      roomId: roomId,
      readingMonth: readingMonth,
      landlordId: openId,
      updatedAt: new Date(),
    };

    if (waterReading !== undefined) {
      meterData.waterReading = parseFloat(waterReading);
      meterData.prevWaterReading = prevWaterReading;
      meterData.waterUsage = Math.max(0, meterData.waterReading - prevWaterReading);
    }

    if (electricityReading !== undefined) {
      meterData.electricityReading = parseFloat(electricityReading);
      meterData.prevElectricityReading = prevElectricityReading;
      meterData.electricityUsage = Math.max(0, meterData.electricityReading - prevElectricityReading);
    }

    let result;
    if (existingRecord._id) {
      delete meterData._id; // Remove _id before updating
      result = await db.collection('meter').doc(existingRecord._id).update({ data: meterData });
      meterData.id = existingRecord._id;
    } else {
      meterData.createdAt = new Date();
      result = await db.collection('meter').add({ data: meterData });
      meterData.id = result._id;
    }

    let billResult = null;
    if (room.data.status === 2 && meterData.waterReading !== undefined && meterData.electricityReading !== undefined) {
        try {
            billResult = await generateBillFromMeter({ roomId, readingMonth, meterData }, openId);
        } catch (billError) {
            console.error('自动生成账单失败:', billError);
        }
    }

    return {
      code: 200,
      message: '抄表记录成功',
      data: {
        id: meterData.id,
        waterUsage: meterData.waterUsage,
        electricityUsage: meterData.electricityUsage,
        billGenerated: !!billResult,
        billId: billResult && billResult.code === 200 ? billResult.data.id : null,
        totalAmount: billResult && billResult.code === 200 ? billResult.data.totalAmount : null,
      }
    };

  } catch (error) {
    console.error('提交抄表记录失败', error);
    throw error;
  }
}

/**
 * 更新单个房间抄表记录
 * @param {Object} params - 参数
 * @param {string} openId - 用户openId
 */
async function updateSingleMeter(params, openId) {
  try {
    const { meterId, waterReading, electricityReading } = params
    
    if (!meterId) {
      return { code: 400, message: '抄表记录ID不能为空' }
    }
    
    // 检查抄表记录
    const meter = await db.collection('meter').doc(meterId).get()
    if (!meter.data) {
      return { code: 404, message: '抄表记录不存在' }
    }
    if (meter.data.landlordId !== openId) {
      return { code: 403, message: '没有权限修改该记录' }
    }
    
    // 重新计算用量
    const waterUsage = Math.max(0, parseFloat(waterReading) - meter.data.prevWaterReading)
    const electricityUsage = Math.max(0, parseFloat(electricityReading) - meter.data.prevElectricityReading)
    
    const updateData = {
      waterReading: parseFloat(waterReading),
      electricityReading: parseFloat(electricityReading),
      waterUsage,
      electricityUsage,
      updatedAt: new Date()
    }
    
    await db.collection('meter').doc(meterId).update({
      data: updateData
    })
    
    // 不再更新room表的水电表读数，只更新meter表
    
    return {
      code: 200,
      message: '抄表记录更新成功',
      data: {
        id: meterId,
        waterUsage,
        electricityUsage
      }
    }
    
  } catch (error) {
    console.error('更新抄表记录失败', error)
    throw error
  }
}

/**
 * 获取抄表历史记录
 * @param {Object} params - 参数
 * @param {string} params.roomId - 房间ID（可选）
 * @param {string} params.buildingId - 楼栋ID（可选）
 * @param {number} params.page - 页码
 * @param {number} params.pageSize - 每页数量
 * @param {string} openId - 用户openId
 */
async function getMeterHistory(params, openId) {
  try {
    const {
      roomId,
      buildingId,
      startMonth,
      endMonth,
      page = 1,
      pageSize = 20
    } = params
    
    const skip = (page - 1) * pageSize
    
    // 构建查询条件
    let query = db.collection('meter').where({
      landlordId: openId
    })
    
    // 添加房间筛选
    if (roomId) {
      query = query.where({
        roomId: roomId
      })
    }
    
    // 添加月份范围筛选
    if (startMonth && endMonth) {
      query = query.where({
        readingMonth: _.gte(startMonth).and(_.lte(endMonth))
      })
    }
    
    // 获取总数
    const countResult = await query.count()
    const total = countResult.total
    
    // 获取数据
    const result = await query
      .orderBy('readingMonth', 'desc')
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    // 获取房间信息
    const roomIds = [...new Set(result.data.map(item => item.roomId))]
    const roomsResult = await db.collection('rooms').where({
      _id: _.in(roomIds),
      landlordId: openId
    }).get()
    
    const roomsMap = {}
    roomsResult.data.forEach(room => {
      roomsMap[room._id] = room
    })
    
    // 组装数据
    const historyList = result.data.map(item => ({
      id: item._id,
      roomId: item.roomId,
      roomName: roomsMap[item.roomId]?.roomName || '',
      buildingName: roomsMap[item.roomId]?.buildingName || '',
      readingMonth: item.readingMonth,
      waterReading: item.waterReading,
      electricityReading: item.electricityReading,
      waterUsage: item.waterUsage,
      electricityUsage: item.electricityUsage,
      recordDate: item.recordDate,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }))
    
    return {
      code: 200,
      message: 'success',
      data: {
        list: historyList,
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total
      }
    }
    
  } catch (error) {
    console.error('获取抄表历史失败', error)
    throw error
  }
}

/**
 * 基于抄表记录生成账单
 * @param {Object} params - 参数
 * @param {string} params.roomId - 房间ID
 * @param {string} params.readingMonth - 抄表月份
 * @param {Object} params.meterData - 抄表数据
 * @param {string} openId - 用户openId
 */
async function generateBillFromMeter(params, openId) {
  try {
    const { roomId, readingMonth, meterData } = params
    
    // 获取房间信息
    const room = await db.collection('rooms').doc(roomId).get()
    if (!room.data || room.data.landlordId !== openId) {
      return { code: 403, message: '没有权限操作该房间' }
    }
    
    const roomData = room.data
    
    // 检查房间是否已出租
    if (roomData.status !== 2) {
      return { code: 400, message: '房间未出租，无需生成账单' }
    }
    
    // 检查是否已存在该月账单
    const existingBill = await db.collection('bills').where({
      roomId: roomId,
      billMonth: readingMonth
    }).get()
    
    // 获取上个月的抄表记录作为上期读数
    const [year, month] = readingMonth.split('-')
    const lastMonthDate = new Date(year, parseInt(month) - 2, 1)
    const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`
    
    let prevWaterReading = 0
    let prevElectricityReading = 0
    
    // 优先查找上个月的抄表记录
    try {
      const lastMeterRecord = await db.collection('meter').where({
        roomId: roomId,
        readingMonth: lastMonthStr,
        landlordId: openId
      }).get()
      
      if (lastMeterRecord.data.length > 0) {
        prevWaterReading = lastMeterRecord.data[0].waterReading || 0
        prevElectricityReading = lastMeterRecord.data[0].electricityReading || 0
      } else {
        // 如果没有上个月记录，使用房间记录的默认值
        prevWaterReading = roomData.lastWaterReading || 0
        prevElectricityReading = roomData.lastElectricityReading || 0
      }
    } catch (error) {
      console.warn('查找上个月抄表记录失败，使用默认值:', error)
      prevWaterReading = roomData.lastWaterReading || 0
      prevElectricityReading = roomData.lastElectricityReading || 0
    }
    
    // 重新计算用量（如果meterData中没有正确的用量）
    const waterUsage = Math.max(0, (meterData.waterReading || 0) - prevWaterReading)
    const electricityUsage = Math.max(0, (meterData.electricityReading || 0) - prevElectricityReading)
    
    // 计算费用
    const rentAmount = roomData.monthlyRent || 0
    const waterAmount = waterUsage * (roomData.waterPrice || 0)
    const electricityAmount = electricityUsage * (roomData.electricityPrice || 0)
    const cleaningAmount = roomData.cleaningFee || 0
    const totalAmount = rentAmount + waterAmount + electricityAmount + cleaningAmount
    
    // 生成账单编号
    const billNo = `B${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
    
    const billData = {
      billNo,
      roomId: roomId,
      tenantId: roomData.tenantId || '',
      tenantName: roomData.tenantName || '',
      tenantPhone: roomData.tenantPhone || '',
      billMonth: readingMonth,
      rentAmount,
      waterAmount,
      electricityAmount,
      cleaningAmount,
      otherDetails: [],
      totalAmount,
      meterReadingId: meterData.id,
      waterUsage: waterUsage,
      electricityUsage: electricityUsage,
      status: 1, // 待支付
      paidAmount: 0,
      landlordId: openId,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    let result
    if (existingBill.data.length > 0) {
      // 更新现有账单
      result = await db.collection('bills')
        .doc(existingBill.data[0]._id)
        .update({
          data: billData
        })
      billData.id = existingBill.data[0]._id
    } else {
      // 创建新账单
      result = await db.collection('bills').add({
        data: billData
      })
      billData.id = result._id
    }
    
    console.log('账单生成成功', {
      billId: billData.id,
      roomId,
      billMonth: readingMonth,
      totalAmount
    })
    
    return {
      code: 200,
      message: '账单生成成功',
      data: billData
    }
    
  } catch (error) {
    console.error('生成账单失败', error)
    throw error
  }
}

/**
 * 获取房间抄表数据（用于显示历史读数）
 * @param {Object} params - 参数
 * @param {string} params.roomId - 房间ID
 * @param {string} params.readingMonth - 抄表月份
 * @param {string} openId - 用户openId
 */
async function getRoomMeterData(params, openId) {
  try {
    const { roomId, readingMonth } = params
    
    // 获取房间信息
    const room = await db.collection('rooms').doc(roomId).get()
    if (!room.data || room.data.landlordId !== openId) {
      return { code: 403, message: '没有权限访问该房间' }
    }
    
    // 获取指定月份的抄表记录
    const meterRecord = await db.collection('meter').where({
      roomId: roomId,
      readingMonth: readingMonth
    }).get()
    
    const roomData = room.data
    
    return {
      code: 200,
      message: 'success',
      data: {
        roomInfo: {
          id: roomData._id,
          roomName: roomData.roomName,
          buildingName: roomData.buildingName,
          lastWaterReading: roomData.lastWaterReading || 0,
          lastElectricityReading: roomData.lastElectricityReading || 0,
          waterPrice: roomData.waterPrice || 0,
          electricityPrice: roomData.electricityPrice || 0
        },
        meterRecord: meterRecord.data.length > 0 ? {
          id: meterRecord.data[0]._id,
          waterReading: meterRecord.data[0].waterReading,
          electricityReading: meterRecord.data[0].electricityReading,
          waterUsage: meterRecord.data[0].waterUsage,
          electricityUsage: meterRecord.data[0].electricityUsage,
          recordDate: meterRecord.data[0].recordDate
        } : null
      }
    }
    
  } catch (error) {
    console.error('获取房间抄表数据失败', error)
    throw error
  }
}

/**
 * 获取上个月的抄表记录
 * @param {Object} params - 参数
 * @param {Array} params.roomIds - 房间ID数组
 * @param {string} params.lastMonth - 上个月份（YYYY-MM）
 * @param {string} openId - 用户openId
 */
async function getLastMonthReadings(params, openId) {
  try {
    const { roomIds, lastMonth } = params
    
    if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
      return { 
        code: 200, 
        message: 'success',
        data: { records: [] }
      }
    }
    
    if (!lastMonth) {
      return { 
        code: 400, 
        message: '上个月份参数不能为空' 
      }
    }
    
    // 查找上个月的抄表记录
    const result = await db.collection('meter').where({
      roomId: db.command.in(roomIds),
      readingMonth: lastMonth,
      landlordId: openId
    }).get()
    
    const records = result.data.map(record => ({
      roomId: record.roomId,
      waterReading: record.waterReading,
      electricityReading: record.electricityReading,
      waterUsage: record.waterUsage,
      electricityUsage: record.electricityUsage,
      recordDate: record.recordDate
    }))
    
    console.log(`获取上个月(${lastMonth})抄表记录成功`, {
      roomCount: roomIds.length,
      recordCount: records.length
    })
    
    return {
      code: 200,
      message: 'success',
      data: {
        records
      }
    }
    
  } catch (error) {
    console.error('获取上个月抄表记录失败', error)
    throw error
  }
}

/**
 * 批量生成账单
 * @param {Object} params - 参数
 * @param {Array} params.roomIds - 房间ID数组
 * @param {string} params.readingMonth - 抄表月份
 * @param {string} params.year - 年份
 * @param {string} params.month - 月份
 * @param {string} openId - 用户openId
 */
async function batchGenerateBills(params, openId) {
  try {
    const { roomIds, readingMonth, year, month } = params
    
    if (!roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
      return { 
        code: 400, 
        message: '房间ID列表不能为空' 
      }
    }
    
    if (!readingMonth) {
      return { 
        code: 400, 
        message: '抄表月份不能为空' 
      }
    }
    
    const results = []
    const errors = []
    
    console.log(`开始批量生成账单`, {
      roomCount: roomIds.length,
      readingMonth,
      openId
    })
    
    // 批量处理每个房间的账单生成
    for (const roomId of roomIds) {
      try {
        // 获取该房间的抄表记录
        const meterRecord = await db.collection('meter').where({
          roomId: roomId,
          readingMonth: readingMonth,
          landlordId: openId
        }).get()
        
        if (meterRecord.data.length === 0) {
          errors.push({
            roomId: roomId,
            error: '未找到抄表记录'
          })
          continue
        }
        
        const meterData = meterRecord.data[0]
        
        // 生成账单
        const billResult = await generateBillFromMeter({
          roomId: roomId,
          readingMonth: readingMonth,
          meterData: meterData
        }, openId)
        
        if (billResult.code === 200) {
          results.push({
            roomId: roomId,
            billId: billResult.data.id,
            totalAmount: billResult.data.totalAmount
          })
        } else {
          errors.push({
            roomId: roomId,
            error: billResult.message
          })
        }
        
      } catch (error) {
        console.error(`房间${roomId}生成账单失败:`, error)
        errors.push({
          roomId: roomId,
          error: error.message
        })
      }
    }
    
    console.log(`批量生成账单完成`, {
      successCount: results.length,
      errorCount: errors.length,
      readingMonth
    })
    
    return {
      code: 200,
      message: `批量生成账单完成，成功${results.length}条，失败${errors.length}条`,
      data: {
        success: results,
        errors: errors,
        successCount: results.length,
        errorCount: errors.length,
        readingMonth: readingMonth
      }
    }
    
  } catch (error) {
    console.error('批量生成账单失败', error)
    throw error
  }
}
