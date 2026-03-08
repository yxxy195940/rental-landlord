// cloudfunctions/bill/index.js
/**
 * 账单管理云函数
 * 
 * 提供账单相关的所有操作，包括：
 * 1. 获取账单列表
 * 2. 获取账单详情
 * 3. 标记收款状态
 * 4. 生成账单图片
 * 5. 批量操作账单
 */

const cloud = require('wx-server-sdk')

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 获取数据库引用
const db = cloud.database()
const _ = db.command

/**
 * 云函数主入口
 * @param {Object} event - 事件参数
 * @param {string} event.action - 操作类型
 * @param {Object} context - 云函数上下文
 */
exports.main = async (event, context) => {
  const { action, ...params } = event
  const { OPENID } = cloud.getWXContext()
  
  console.log('账单云函数调用', {
    action,
    params,
    openId: OPENID,
    timestamp: new Date().toISOString()
  })
  
  try {
    switch (action) {
      case 'preview':
        return await previewBill(params, OPENID)
      case 'list':
        return await getBillList(params, OPENID)
      case 'detail':
        return await getBillDetail(params, OPENID)
      case 'markPaid':
        return await markBillPaid(params, OPENID)
      case 'batchMarkPaid':
        return await batchMarkBillPaid(params, OPENID)
      case 'generateImage':
        return await generateBillImage(params, OPENID)
      case 'getStatistics':
        return await getBillStatistics(params, OPENID)
      case 'create':
        return await createBill(params, OPENID)
      case 'update':
        return await updateBill(params, OPENID)
      case 'delete':
        return await deleteBill(params, OPENID)
      default:
        return {
          code: 400,
          message: `未知的操作类型: ${action}`,
          data: null
        }
    }
  } catch (error) {
    console.error('账单云函数执行失败', {
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
 * 获取账单列表
 * @param {Object} params - 参数
 * @param {string} params.buildingId - 楼栋ID（可选）
 * @param {string} params.roomId - 房间ID（可选）
 * @param {string} params.billMonth - 账单月份（可选）
 * @param {number} params.status - 账单状态（可选）1-待支付 2-已支付 3-已作废
 * @param {number} params.page - 页码
 * @param {number} params.pageSize - 每页数量
 * @param {string} openId - 用户openId
 */
async function getBillList(params, openId) {
  try {
    const {
      buildingId,
      roomId,
      billMonth,
      status,
      keyword,
      page = 1,
      pageSize = 20
    } = params
    
    // 1. 获取所有相关房间（已出租，或有指定关键字/ID的房间）
    let roomQueryCondition = {
      landlordId: openId,
      isDeleted: false
    }
    if (buildingId) {
      roomQueryCondition.buildingId = buildingId
    }
    if (roomId) {
      roomQueryCondition._id = roomId
    }
    if (keyword && keyword.trim()) {
      roomQueryCondition.roomName = db.RegExp({
        regexp: keyword.trim(),
        options: 'i'
      })
    }

    // 获取满足条件的房间（最多1000个，通常房东的房间数不会超过这个限制）
    const roomsResult = await db.collection('rooms')
      .where(roomQueryCondition)
      .limit(1000)
      .get()
    const rooms = roomsResult.data
    const roomMap = {}
    const roomIds = []
    rooms.forEach(r => {
      roomMap[r._id] = r
      roomIds.push(r._id)
    })

    // 2. 获取当月账单
    let billQueryCondition = {
      landlordId: openId
    }
    if (billMonth) {
      billQueryCondition.billMonth = billMonth
    }
    if (roomIds.length > 0) {
      billQueryCondition.roomId = _.in(roomIds)
    }

    const billsResult = await db.collection('bills')
      .where(billQueryCondition)
      .limit(1000)
      .get()
    const bills = billsResult.data
    
    // 建立以roomId为key的账单映射 (目前已不需要单独依赖这个，因为要支持多次开单，但保留用于判定"该房间彻底没有开过单")
    const billMap = {}
    bills.forEach(b => {
      // 排除已作废的账单(status: 3)
      if (b.status !== 3) {
        billMap[b.roomId] = true
      }
    })

    // 2.5 获取当月有未开单抄表记录的房间
    let unbilledMetersRoomIds = new Set()
    if (billMonth) {
      const unbilledMetersResult = await db.collection('meter').where({
        landlordId: openId,
        readingMonth: billMonth,
        isBilled: false
      }).limit(1000).get()
      
      unbilledMetersResult.data.forEach(m => {
        unbilledMetersRoomIds.add(m.roomId)
      })
    }

    // 3. 组合列表：每个房间对应一个列表项，如果本月没有账单并且房间是已出租状态，则为“未开单”
    let combinedList = []
    
    // 遍历有账单的记录
    bills.forEach(bill => {
      if (bill.status !== 3) {
        const room = roomMap[bill.roomId] || {}
        combinedList.push({
          id: bill._id,
          billNo: bill.billNo,
          roomId: bill.roomId,
          roomNumber: bill.snapshot?.roomName || room.roomName || '',
          buildingName: bill.snapshot?.buildingName || room.buildingName || '',
          tenantName: bill.snapshot?.tenantName || bill.tenantName || room.tenantName,
          tenantPhone: bill.tenantPhone || room.tenantPhone,
          billMonth: bill.billMonth,
          rentAmount: bill.rentAmount || 0,
          waterAmount: bill.waterAmount || 0,
          electricityAmount: bill.electricityAmount || 0,
          cleaningAmount: bill.cleaningAmount || 0,
          managementFee: bill.managementFee || 0,
          internetFee: bill.internetFee || 0,
          otherFee: bill.otherFee || 0,
          totalAmount: bill.totalAmount || 0,
          waterUsage: bill.waterUsage || 0,
          electricityUsage: bill.electricityUsage || 0,
          status: bill.status || 1, // 1待支付，2已支付
          statusText: getStatusText(bill.status),
          paidAmount: bill.paidAmount || 0,
          paidAt: bill.paidAt,
          paymentMethod: bill.paymentMethod,
          createdAt: bill.createdAt,
          updatedAt: bill.updatedAt
        })
      }
    })

    // 遍历已出租但没有账单的房间，或者有新未开单记录的房间（未开单）
    if (billMonth) { // 只有指定了月份才好计算未开单
      rooms.forEach(room => {
        const hasNoBills = !billMap[room._id]
        const hasUnbilledMeter = unbilledMetersRoomIds.has(room._id)
        
        // 当月未开单：1. 房间在租且本月没开过单； 2. 房间有未开单的新抄表记录
        if ((room.status === 2 && hasNoBills) || hasUnbilledMeter) {
          combinedList.push({
            id: `unbilled_${room._id}`,
            isUnbilled: true, // 标识为未开单记录
            roomId: room._id,
            roomNumber: room.roomName || '',
            buildingName: room.buildingName || '',
            tenantName: room.tenantName || '',
            tenantPhone: room.tenantPhone || '',
            billMonth: billMonth,
            rentAmount: room.monthlyRent || 0,
            waterAmount: 0,
            electricityAmount: 0,
            cleaningAmount: room.cleaningFee || room.sanitationFee || 0,
            managementFee: room.managementFee || 0,
            internetFee: room.internetFee || 0,
            otherFee: room.otherFee || 0,
            totalAmount: 0, // 未开单金额暂不可知，需预览
            waterUsage: 0,
            electricityUsage: 0,
            status: 0, // 0表示未开单
            statusText: '未开单',
            paidAmount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          })
        }
      })
    }

    // 如果指定了status筛选，目前只支持数据库已有状态，但如果要支持status=0（未开单）可以在此过滤
    if (status !== undefined && status !== null) {
      combinedList = combinedList.filter(item => item.status === status)
    }

    // 4. 内存排序和分页
    // 排序：先按状态（未开单 > 待支付 > 已支付），再按房间号
    combinedList.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status - b.status // 0 (未开单) 排前面
      }
      const numA = parseInt(a.roomNumber.replace(/[^0-9]/ig, "")) || 0;
      const numB = parseInt(b.roomNumber.replace(/[^0-9]/ig, "")) || 0;
      if (numA !== numB) return numA - numB;
      return a.roomNumber.localeCompare(b.roomNumber, 'zh-Hans-CN');
    })

    const total = combinedList.length
    const skip = (page - 1) * pageSize
    const pagedList = combinedList.slice(skip, skip + pageSize)
    
    return {
      code: 200,
      message: 'success',
      data: {
        list: pagedList,
        total,
        page,
        pageSize,
        hasMore: skip + pageSize < total
      }
    }
    
  } catch (error) {
    console.error('获取账单列表失败', error)
    throw error
  }
}

/**
 * 获取账单详情
 * @param {Object} params - 参数
 * @param {string} params.billId - 账单ID
 * @param {string} openId - 用户openId
 */
async function getBillDetail(params, openId) {
  try {
    const { billId } = params
    
    if (!billId) {
      return { code: 400, message: '账单ID不能为空' }
    }
    
    // 获取账单信息
    const billResult = await db.collection('bills').doc(billId).get()
    
    if (!billResult.data) {
      return { code: 404, message: '账单不存在' }
    }
    
    const bill = billResult.data
    
    if (bill.landlordId !== openId) {
      return { code: 403, message: '没有权限访问该账单' }
    }
    
    // 获取房间信息
    const roomResult = await db.collection('rooms').doc(bill.roomId).get()
    const room = roomResult.data
    
    // 获取抄表记录
    let waterRecord = null
    let electricityRecord = null
    if (bill.waterMeterReadingId || bill.electricityMeterReadingId) {
      if (bill.waterMeterReadingId) {
        const waterResult = await db.collection('meter').doc(bill.waterMeterReadingId).get()
        waterRecord = waterResult.data
      }
      if (bill.electricityMeterReadingId) {
        const electricityResult = await db.collection('meter').doc(bill.electricityMeterReadingId).get()
        electricityRecord = electricityResult.data
      }
    } else if (bill.meterReadingId) {
      const meterResult = await db.collection('meter').doc(bill.meterReadingId).get()
      waterRecord = meterResult.data
      electricityRecord = meterResult.data
    }
    
    const billDetail = {
      id: bill._id,
      billNo: bill.billNo,
      roomId: bill.roomId,
      roomNumber: bill.snapshot?.roomName || room?.roomName || '',
      buildingName: bill.snapshot?.buildingName || room?.buildingName || '',
      tenantName: bill.snapshot?.tenantName || bill.tenantName,
      tenantPhone: bill.tenantPhone,
      billMonth: bill.billMonth,
      
      // 费用明细
      rentAmount: bill.rentAmount || 0,
      waterAmount: bill.waterAmount || 0,
      electricityAmount: bill.electricityAmount || 0,
      cleaningAmount: bill.cleaningAmount || 0,
      managementFee: bill.managementFee || 0,
      internetFee: bill.internetFee || 0,
      otherFee: bill.otherFee || 0,
      otherDetails: bill.otherDetails || [],
      totalAmount: bill.totalAmount || 0,
      
      // 用量信息
      waterUsage: bill.waterUsage || 0,
      electricityUsage: bill.electricityUsage || 0,
      waterPrice: bill.snapshot?.waterPrice !== undefined ? bill.snapshot.waterPrice : (room?.waterPrice || 0),
      electricityPrice: bill.snapshot?.electricityPrice !== undefined ? bill.snapshot.electricityPrice : (room?.electricityPrice || 0),
      
      // 支付信息
      status: bill.status || 1,
      statusText: getStatusText(bill.status),
      paidAmount: bill.paidAmount || 0,
      paidAt: bill.paidAt,
      paymentMethod: bill.paymentMethod,
      
      // 抄表信息
      meterRecord: (waterRecord || electricityRecord) ? {
        waterReading: waterRecord?.waterReading,
        electricityReading: electricityRecord?.electricityReading,
        prevWaterReading: waterRecord?.prevWaterReading,
        prevElectricityReading: electricityRecord?.prevElectricityReading,
        recordDate: waterRecord?.recordDate || electricityRecord?.recordDate
      } : null,
      
      createdAt: bill.createdAt,
      updatedAt: bill.updatedAt,
      snapshot: bill.snapshot || null
    }
    
    return {
      code: 200,
      message: 'success',
      data: billDetail
    }
    
  } catch (error) {
    console.error('获取账单详情失败', error)
    throw error
  }
}

/**
 * 标记账单为已收款
 * @param {Object} params - 参数
 * @param {string} params.billId - 账单ID
 * @param {number} params.paidAmount - 实收金额
 * @param {string} params.paymentMethod - 支付方式
 * @param {string} params.remark - 备注
 * @param {string} openId - 用户openId
 */
async function markBillPaid(params, openId) {
  try {
    const { billId, paidAmount, paymentMethod = 'cash', remark } = params
    
    if (!billId) {
      return { code: 400, message: '账单ID不能为空' }
    }
    
    // 检查账单
    const bill = await db.collection('bills').doc(billId).get()
    if (!bill.data) {
      return { code: 404, message: '账单不存在' }
    }
    if (bill.data.landlordId !== openId) {
      return { code: 403, message: '没有权限操作该账单' }
    }
    
    const billData = bill.data
    const actualPaidAmount = paidAmount || billData.totalAmount
    
    // 更新账单状态
    const updateData = {
      status: 2, // 已支付
      paidAmount: actualPaidAmount,
      paidAt: new Date(),
      paymentMethod: paymentMethod,
      remark: remark || '',
      updatedAt: new Date()
    }
    
    await db.collection('bills').doc(billId).update({
      data: updateData
    })
    
    // 可以在这里添加生成收据的逻辑
    const receiptNo = `R${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
    
    // 创建收据记录（可选）
    try {
      await db.collection('receipts').add({
        data: {
          receiptNo: receiptNo,
          billId: billId,
          amount: actualPaidAmount,
          paymentMethod: paymentMethod,
          payerName: billData.tenantName,
          receiptDate: new Date().toISOString().split('T')[0],
          remark: remark || '',
          landlordId: openId,
          createdAt: new Date()
        }
      })
    } catch (receiptError) {
      console.error('创建收据记录失败:', receiptError)
      // 不影响主流程
    }
    
    console.log('账单标记已收款成功', {
      billId,
      paidAmount: actualPaidAmount,
      paymentMethod
    })
    
    return {
      code: 200,
      message: '标记收款成功',
      data: {
        id: billId,
        status: 2,
        paidAmount: actualPaidAmount,
        receiptNo: receiptNo
      }
    }
    
  } catch (error) {
    console.error('标记账单收款失败', error)
    throw error
  }
}

/**
 * 批量标记账单为已收款
 * @param {Object} params - 参数
 * @param {Array} params.billIds - 账单ID数组
 * @param {string} params.paymentMethod - 支付方式
 * @param {string} params.remark - 备注
 * @param {string} openId - 用户openId
 */
async function batchMarkBillPaid(params, openId) {
  try {
    const { billIds, paymentMethod = 'cash', remark } = params
    
    if (!billIds || !Array.isArray(billIds) || billIds.length === 0) {
      return { code: 400, message: '账单ID列表不能为空' }
    }
    
    const results = []
    const errors = []
    
    // 批量处理
    for (const billId of billIds) {
      try {
        const result = await markBillPaid({
          billId,
          paymentMethod,
          remark
        }, openId)
        
        if (result.code === 200) {
          results.push(result.data)
        } else {
          errors.push({
            billId,
            error: result.message
          })
        }
      } catch (error) {
        errors.push({
          billId,
          error: error.message
        })
      }
    }
    
    return {
      code: 200,
      message: `批量标记完成，成功${results.length}条，失败${errors.length}条`,
      data: {
        success: results,
        errors: errors,
        successCount: results.length,
        errorCount: errors.length
      }
    }
    
  } catch (error) {
    console.error('批量标记账单收款失败', error)
    throw error
  }
}

/**
 * 生成账单图片（暂时返回模拟数据）
 * @param {Object} params - 参数
 * @param {string} params.billId - 账单ID
 * @param {string} openId - 用户openId
 */
async function generateBillImage(params, openId) {
  try {
    const { billId } = params
    
    // 获取账单详情
    const billDetailResult = await getBillDetail({ billId }, openId)
    if (billDetailResult.code !== 200) {
      return billDetailResult
    }
    
    const billDetail = billDetailResult.data
    
    // 这里应该实现真正的图片生成逻辑
    // 可以使用 Canvas API 或者第三方服务
    const imageUrl = `https://example.com/bill-images/${billId}.png`
    
    console.log('生成账单图片', { billId, imageUrl })
    
    return {
      code: 200,
      message: '账单图片生成成功',
      data: {
        billId: billId,
        imageUrl: imageUrl,
        billDetail: billDetail
      }
    }
    
  } catch (error) {
    console.error('生成账单图片失败', error)
    throw error
  }
}

/**
 * 获取账单统计信息
 * @param {Object} params - 参数
 * @param {string} params.startMonth - 开始月份
 * @param {string} params.endMonth - 结束月份
 * @param {string} openId - 用户openId
 */
async function getBillStatistics(params, openId) {
  try {
    const { startMonth, endMonth } = params
    
    // 构建查询条件
    let query = db.collection('bills').where({
      landlordId: openId
    })
    
    if (startMonth && endMonth) {
      query = query.where({
        billMonth: _.gte(startMonth).and(_.lte(endMonth))
      })
    }
    
    // 获取所有匹配的账单
    const billsResult = await query.get()
    const bills = billsResult.data
    
    // 计算统计数据
    const statistics = {
      totalBills: bills.length,
      paidBills: bills.filter(b => b.status === 2).length,
      unpaidBills: bills.filter(b => b.status === 1).length,
      totalAmount: bills.reduce((sum, b) => sum + (b.totalAmount || 0), 0),
      paidAmount: bills.filter(b => b.status === 2).reduce((sum, b) => sum + (b.paidAmount || 0), 0),
      unpaidAmount: bills.filter(b => b.status === 1).reduce((sum, b) => sum + (b.totalAmount || 0), 0),
      
      // 费用类型统计
      rentTotal: bills.reduce((sum, b) => sum + (b.rentAmount || 0), 0),
      waterTotal: bills.reduce((sum, b) => sum + (b.waterAmount || 0), 0),
      electricityTotal: bills.reduce((sum, b) => sum + (b.electricityAmount || 0), 0),
      
      // 月度统计
      monthlyStats: {}
    }
    
    // 按月份统计
    bills.forEach(bill => {
      const month = bill.billMonth
      if (!statistics.monthlyStats[month]) {
        statistics.monthlyStats[month] = {
          totalBills: 0,
          paidBills: 0,
          totalAmount: 0,
          paidAmount: 0
        }
      }
      
      const monthStat = statistics.monthlyStats[month]
      monthStat.totalBills++
      monthStat.totalAmount += bill.totalAmount || 0
      
      if (bill.status === 2) {
        monthStat.paidBills++
        monthStat.paidAmount += bill.paidAmount || 0
      }
    })
    
    return {
      code: 200,
      message: 'success',
      data: statistics
    }
    
  } catch (error) {
    console.error('获取账单统计失败', error)
    throw error
  }
}

/**
 * 预览账单（快照开单前获取计算结果）
 * @param {Object} params - 参数
 * @param {string} params.roomId - 房间ID
 * @param {string} params.billMonth - 账单月份
 * @param {string} openId - 用户openId
 */
async function previewBill(params, openId) {
  try {
    const { roomId, billMonth } = params
    
    if (!roomId || !billMonth) {
      return { code: 400, message: '参数不完整' }
    }
    
    // 获取房间信息
    const roomResult = await db.collection('rooms').doc(roomId).get()
    const room = roomResult.data
    
    if (!room || room.landlordId !== openId) {
      return { code: 403, message: '无权限访问此房间' }
    }
    
    // 获取当月抄表记录
    const waterRecordResult = await db.collection('meter').where({
      roomId: roomId,
      meterType: 'water',
      readingMonth: billMonth
    }).orderBy('updatedAt', 'desc').limit(1).get()
    
    const electricityRecordResult = await db.collection('meter').where({
      roomId: roomId,
      meterType: 'electricity',
      readingMonth: billMonth
    }).orderBy('updatedAt', 'desc').limit(1).get()
    
    const waterRecord = waterRecordResult.data[0] || null
    const electricityRecord = electricityRecordResult.data[0] || null
    
    // 计算用量
    const waterUsage = waterRecord ? (waterRecord.waterUsage !== undefined ? waterRecord.waterUsage : Math.max(0, (waterRecord.waterReading || 0) - (waterRecord.prevWaterReading || 0))) : 0
    const electricityUsage = electricityRecord ? (electricityRecord.electricityUsage !== undefined ? electricityRecord.electricityUsage : Math.max(0, (electricityRecord.electricityReading || 0) - (electricityRecord.prevElectricityReading || 0))) : 0
    
    // 获取费用单价
    const rentAmount = room.monthlyRent || 0
    const waterPrice = room.waterPrice || 0
    const electricityPrice = room.electricityPrice || 0
    const cleaningAmount = room.cleaningFee || room.sanitationFee || 0
    const managementFee = room.managementFee || 0
    const internetFee = room.internetFee || 0
    const otherFee = room.otherFee || 0
    
    // 计算金额
    // 取2位小数，防止精度问题
    const waterAmount = Math.round(waterUsage * waterPrice * 100) / 100
    const electricityAmount = Math.round(electricityUsage * electricityPrice * 100) / 100
    const totalAmount = Math.round((rentAmount + waterAmount + electricityAmount + cleaningAmount + managementFee + internetFee + otherFee) * 100) / 100
    
    const previewData = {
      roomId: room._id,
      roomNumber: room.roomName || '',
      buildingName: room.buildingName || '',
      tenantName: room.tenantName || '',
      tenantPhone: room.tenantPhone || '',
      billMonth: billMonth,
      
      waterPrice,
      electricityPrice,
      
      rentAmount,
      waterUsage,
      waterAmount,
      electricityUsage,
      electricityAmount,
      cleaningAmount,
      managementFee,
      internetFee,
      otherFee,
      totalAmount,
      
      meterRecord: {
        prevWaterReading: waterRecord?.prevWaterReading,
        waterReading: waterRecord?.waterReading,
        prevElectricityReading: electricityRecord?.prevElectricityReading,
        electricityReading: electricityRecord?.electricityReading,
        recordDate: waterRecord?.recordDate || electricityRecord?.recordDate || new Date()
      },
      
      snapshot: {
        roomName: room.roomName,
        buildingName: room.buildingName || '',
        tenantName: room.tenantName || '',
        waterPrice,
        electricityPrice,
        monthlyRent: rentAmount
      },
      status: 0, // 预览状态
      statusText: '未开单',
      waterMeterReadingId: waterRecord?._id || '',
      electricityMeterReadingId: electricityRecord?._id || ''
    }
    
    return {
      code: 200,
      message: 'success',
      data: previewData
    }
  } catch (error) {
    console.error('预览账单失败', error)
    throw error
  }
}

/**
 * 创建账单
 * @param {Object} params - 参数
 * @param {string} openId - 用户openId
 */
async function createBill(params, openId) {
  try {
    const billPayload = params.billData || params
    const { roomId } = billPayload

    if (!roomId) {
      return { code: 400, message: '房间ID不能为空' }
    }

    // 校验房间归属
    const roomRes = await db.collection('rooms').doc(roomId).get()
    if (!roomRes.data || roomRes.data.landlordId !== openId) {
      return { code: 403, message: '没有权限创建该房间账单' }
    }
    const room = roomRes.data

    // 组装账单数据
    const now = new Date()
    const roomIdSuffix = roomId.slice(-4)
    const billNo = `B${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${roomIdSuffix}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`

    const billData = {
      billNo,
      roomId,
      landlordId: openId,
      tenantName: billPayload.tenantName || room.tenantName || '',
      tenantPhone: billPayload.tenantPhone || room.tenantPhone || '',
      billMonth: billPayload.billMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      rentAmount: billPayload.rentAmount || 0,
      waterAmount: billPayload.waterAmount || 0,
      electricityAmount: billPayload.electricityAmount || 0,
      cleaningAmount: billPayload.cleaningAmount || 0,
      managementFee: billPayload.managementFee || 0,
      internetFee: billPayload.internetFee || 0,
      otherFee: billPayload.otherFee || 0,
      otherDetails: billPayload.otherDetails || [],
      totalAmount: billPayload.totalAmount || 0,
      waterUsage: billPayload.waterUsage || 0,
      electricityUsage: billPayload.electricityUsage || 0,
      meterReadingId: billPayload.meterReadingId || '',
      waterMeterReadingId: billPayload.waterMeterReadingId || '',
      electricityMeterReadingId: billPayload.electricityMeterReadingId || '',
      status: 1,
      paidAmount: 0,
      createdAt: now,
      updatedAt: now,
      checkoutDate: billPayload.checkoutDate || '',
      remark: billPayload.remark || '',
      snapshot: billPayload.snapshot || {}
    }

    const result = await db.collection('bills').add({
      data: billData
    })

    // 更新对应的抄表记录状态为已开单
    const meterIdsToUpdate = []
    if (billData.waterMeterReadingId) meterIdsToUpdate.push(billData.waterMeterReadingId)
    if (billData.electricityMeterReadingId) meterIdsToUpdate.push(billData.electricityMeterReadingId)
    
    if (meterIdsToUpdate.length > 0) {
      try {
        await db.collection('meter').where({
          _id: _.in(meterIdsToUpdate)
        }).update({
          data: {
            isBilled: true,
            updatedAt: new Date()
          }
        })
      } catch (updateMeterErr) {
        console.error('更新抄表记录isBilled状态失败:', updateMeterErr)
      }
    }

    return {
      code: 200,
      message: '账单创建成功',
      data: { id: result._id, ...billData }
    }
  } catch (error) {
    console.error('创建账单失败', error)
    throw error
  }
}

/**
 * 更新账单
 * @param {Object} params - 参数
 * @param {string} openId - 用户openId
 */
async function updateBill(params, openId) {
  try {
    const { billId, updateData } = params
    
    if (!billId) {
      return { code: 400, message: '账单ID不能为空' }
    }
    
    // 检查账单权限
    const bill = await db.collection('bills').doc(billId).get()
    if (!bill.data || bill.data.landlordId !== openId) {
      return { code: 403, message: '没有权限修改该账单' }
    }
    
    // 更新账单
    const result = await db.collection('bills').doc(billId).update({
      data: {
        ...updateData,
        updatedAt: new Date()
      }
    })
    
    return {
      code: 200,
      message: '账单更新成功',
      data: { id: billId, updated: result.stats.updated }
    }
    
  } catch (error) {
    console.error('更新账单失败', error)
    throw error
  }
}

/**
 * 删除账单
 * @param {Object} params - 参数
 * @param {string} openId - 用户openId
 */
async function deleteBill(params, openId) {
  try {
    const { billId } = params
    
    if (!billId) {
      return { code: 400, message: '账单ID不能为空' }
    }
    
    // 检查账单权限
    const bill = await db.collection('bills').doc(billId).get()
    if (!bill.data || bill.data.landlordId !== openId) {
      return { code: 403, message: '没有权限删除该账单' }
    }
    
    // 软删除账单
    await db.collection('bills').doc(billId).update({
      data: {
        status: 3, // 已作废
        deletedAt: new Date(),
        updatedAt: new Date()
      }
    })
    
    return {
      code: 200,
      message: '账单删除成功',
      data: { id: billId, deleted: true }
    }
    
  } catch (error) {
    console.error('删除账单失败', error)
    throw error
  }
}

/**
 * 获取状态文本
 * @param {number} status - 状态码
 */
function getStatusText(status) {
  switch (status) {
    case 1: return '待支付'
    case 2: return '已支付'
    case 3: return '已作废'
    default: return '未知状态'
  }
}
