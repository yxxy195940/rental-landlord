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
    
    const skip = (page - 1) * pageSize
    
    // 构建查询条件
    let query = db.collection('bills').where({
      landlordId: openId
    })
    
    // 添加筛选条件
    if (roomId) {
      query = query.where({ roomId: roomId })
    }
    
    if (billMonth) {
      query = query.where({ billMonth: billMonth })
    }
    
    if (status !== undefined) {
      query = query.where({ status: status })
    }
    
    // 如果指定了楼栋，需要先获取该楼栋下的房间
    if (buildingId) {
      const roomsResult = await db.collection('rooms').where({
        buildingId: buildingId,
        landlordId: openId,
        isDeleted: false
      }).get()
      
      const roomIds = roomsResult.data.map(room => room._id)
      if (roomIds.length > 0) {
        query = query.where({
          roomId: _.in(roomIds)
        })
      } else {
        // 该楼栋下没有房间，直接返回空结果
        return {
          code: 200,
          message: 'success',
          data: {
            list: [],
            total: 0,
            page,
            pageSize,
            hasMore: false
          }
        }
      }
    }
    
    // 关键词搜索（房间号）
    if (keyword && keyword.trim()) {
      // 先通过房间名搜索房间，然后获取对应的账单
      const roomsResult = await db.collection('rooms').where({
        landlordId: openId,
        roomName: db.RegExp({
          regexp: keyword.trim(),
          options: 'i'
        }),
        isDeleted: false
      }).get()
      
      const roomIds = roomsResult.data.map(room => room._id)
      if (roomIds.length > 0) {
        query = query.where({
          roomId: _.in(roomIds)
        })
      } else {
        // 没有匹配的房间，返回空结果
        return {
          code: 200,
          message: 'success',
          data: {
            list: [],
            total: 0,
            page,
            pageSize,
            hasMore: false
          }
        }
      }
    }
    
    // 获取总数
    const countResult = await query.count()
    const total = countResult.total
    
    // 获取数据
    const billsResult = await query
      .orderBy('billMonth', 'desc')
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    // 获取房间信息
    const roomIds = [...new Set(billsResult.data.map(bill => bill.roomId))]
    const roomsResult = await db.collection('rooms').where({
      _id: _.in(roomIds),
      landlordId: openId
    }).get()
    
    const roomsMap = {}
    roomsResult.data.forEach(room => {
      roomsMap[room._id] = room
    })
    
    // 组装账单数据
    const billList = billsResult.data.map(bill => {
      const room = roomsMap[bill.roomId]
      return {
        id: bill._id,
        billNo: bill.billNo,
        roomId: bill.roomId,
        roomNumber: room?.roomName || '',
        buildingName: room?.buildingName || '',
        tenantName: bill.tenantName,
        tenantPhone: bill.tenantPhone,
        billMonth: bill.billMonth,
        rentAmount: bill.rentAmount || 0,
        waterAmount: bill.waterAmount || 0,
        electricityAmount: bill.electricityAmount || 0,
        cleaningAmount: bill.cleaningAmount || 0,
        totalAmount: bill.totalAmount || 0,
        waterUsage: bill.waterUsage || 0,
        electricityUsage: bill.electricityUsage || 0,
        status: bill.status || 1,
        statusText: getStatusText(bill.status),
        paidAmount: bill.paidAmount || 0,
        paidAt: bill.paidAt,
        paymentMethod: bill.paymentMethod,
        createdAt: bill.createdAt,
        updatedAt: bill.updatedAt
      }
    })
    
    console.log('账单列表查询成功', {
      total,
      count: billList.length,
      page,
      pageSize
    })
    
    return {
      code: 200,
      message: 'success',
      data: {
        list: billList,
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total
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
    let meterRecord = null
    if (bill.meterReadingId) {
      const meterResult = await db.collection('meter').doc(bill.meterReadingId).get()
      meterRecord = meterResult.data
    }
    
    const billDetail = {
      id: bill._id,
      billNo: bill.billNo,
      roomId: bill.roomId,
      roomNumber: room?.roomName || '',
      buildingName: room?.buildingName || '',
      tenantName: bill.tenantName,
      tenantPhone: bill.tenantPhone,
      billMonth: bill.billMonth,
      
      // 费用明细
      rentAmount: bill.rentAmount || 0,
      waterAmount: bill.waterAmount || 0,
      electricityAmount: bill.electricityAmount || 0,
      cleaningAmount: bill.cleaningAmount || 0,
      otherDetails: bill.otherDetails || [],
      totalAmount: bill.totalAmount || 0,
      
      // 用量信息
      waterUsage: bill.waterUsage || 0,
      electricityUsage: bill.electricityUsage || 0,
      waterPrice: room?.waterPrice || 0,
      electricityPrice: room?.electricityPrice || 0,
      
      // 支付信息
      status: bill.status || 1,
      statusText: getStatusText(bill.status),
      paidAmount: bill.paidAmount || 0,
      paidAt: bill.paidAt,
      paymentMethod: bill.paymentMethod,
      
      // 抄表信息
      meterRecord: meterRecord ? {
        waterReading: meterRecord.waterReading,
        electricityReading: meterRecord.electricityReading,
        recordDate: meterRecord.recordDate
      } : null,
      
      createdAt: bill.createdAt,
      updatedAt: bill.updatedAt
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
 * 创建账单
 * @param {Object} params - 参数
 * @param {string} openId - 用户openId
 */
async function createBill(params, openId) {
  try {
    // 这个功能主要由抄表云函数调用
    // 这里可以实现手动创建账单的逻辑
    return {
      code: 400,
      message: '手动创建账单功能暂未开放，请通过抄表功能生成账单'
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