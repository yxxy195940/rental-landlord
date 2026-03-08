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
      case 'batchInitRecord':
        return await batchInitRecord(params, OPENID)
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
    const { buildingId } = params;
    let { currentMonth, previousMonth } = params;

    if (!buildingId) {
      return { code: 400, message: '楼栋ID不能为空' };
    }

    const formatMonth = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    };

    const getPreviousMonthFromString = (monthStr) => {
      const [y, m] = monthStr.split('-').map(num => parseInt(num, 10));
      const date = new Date(y, m - 1, 1);
      date.setMonth(date.getMonth() - 1);
      return formatMonth(date);
    };

    if (!currentMonth) {
      currentMonth = formatMonth(new Date());
    }
    if (!previousMonth) {
      previousMonth = getPreviousMonthFromString(currentMonth);
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

    // 2. 获取每个房间水表/电表的最新已开单记录和未开单记录
    const billedAgg = await db.collection('meter')
      .aggregate()
      .match({
        roomId: _.in(roomIds),
        landlordId: openId,
        isBilled: true
      })
      .sort({
        recordDate: -1,
        createdAt: -1
      })
      .group({
        _id: {
          roomId: '$roomId',
          meterType: '$meterType'
        },
        record: $.first('$$ROOT')
      })
      .end();

    const unbilledAgg = await db.collection('meter')
      .aggregate()
      .match({
        roomId: _.in(roomIds),
        landlordId: openId,
        isBilled: _.neq(true)
      })
      .sort({
        recordDate: -1,
        createdAt: -1
      })
      .group({
        _id: {
          roomId: '$roomId',
          meterType: '$meterType'
        },
        record: $.first('$$ROOT')
      })
      .end();

    const billedMap = {};
    (billedAgg.list || []).forEach(item => {
      const roomId = item._id?.roomId;
      const meterType = item._id?.meterType || 'legacy';
      if (!roomId) return;
      if (!billedMap[roomId]) billedMap[roomId] = {};
      billedMap[roomId][meterType] = item.record;
    });

    const unbilledMap = {};
    (unbilledAgg.list || []).forEach(item => {
      const roomId = item._id?.roomId;
      const meterType = item._id?.meterType || 'legacy';
      if (!roomId) return;
      if (!unbilledMap[roomId]) unbilledMap[roomId] = {};
      unbilledMap[roomId][meterType] = item.record;
    });

    // 3. 组装数据
    const finalRoomData = rooms.map(room => {
      const roomBilled = billedMap[room._id] || {};
      const roomUnbilled = unbilledMap[room._id] || {};
      
      const billedWater = roomBilled.water || null;
      const billedElectricity = roomBilled.electricity || null;

      const unbilledWater = roomUnbilled.water || null;
      const unbilledElectricity = roomUnbilled.electricity || null;

      // 上次读数来源：优先最新已开单记录，其次是房间的初始值
      const lastWaterReading = billedWater && billedWater.waterReading !== undefined
        ? billedWater.waterReading
        : (room.lastWaterReading || 0);
      const lastElectricityReading = billedElectricity && billedElectricity.electricityReading !== undefined
        ? billedElectricity.electricityReading
        : (room.lastElectricityReading || 0);

      const getLatestTime = (record) => {
        if (!record) return null;
        return record.recordDate || record.updatedAt || record.createdAt || null;
      };

      return {
        ...room,
        // 当前月抄表信息（如果存在未开单记录则带出）
        currentMeterReading: {
          water: unbilledWater ? unbilledWater.waterReading : '',
          electricity: unbilledElectricity ? unbilledElectricity.electricityReading : '',
        },
        // 上次读数（已开单的读数）
        lastMeterReading: {
          water: lastWaterReading,
          electricity: lastElectricityReading,
        },
        // 上期读数时间
        previousMeterTime: {
          water: getLatestTime(billedWater) || room.lastMeterReadingDate || null,
          electricity: getLatestTime(billedElectricity) || room.lastMeterReadingDate || null
        }
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
 * 批量设置初始抄表
 * @param {Object} params - 参数
 * @param {Array} params.records - 初始抄表数据
 * @param {string} params.buildingId - 楼栋ID（可选，仅用于日志）
 * @param {string} openId - 用户openId
 */
async function batchInitRecord(params, openId) {
  try {
    const { records, buildingId } = params
    
    if (!Array.isArray(records) || records.length === 0) {
      return { code: 400, message: '抄表记录不能为空' }
    }
    
    const success = []
    const errors = []
    
    for (const record of records) {
      try {
        const { roomId, waterReading, electricityReading, recordDate } = record
        
        if (!roomId || (waterReading === undefined && electricityReading === undefined)) {
          errors.push({ roomId, error: '参数不完整' })
          continue
        }
        
        const roomResult = await db.collection('rooms').doc(roomId).get()
        if (!roomResult.data) {
          errors.push({ roomId, error: '房间不存在' })
          continue
        }
        if (roomResult.data.landlordId !== openId) {
          errors.push({ roomId, error: '没有权限设置该房间' })
          continue
        }
        
        const updateData = {
          updatedAt: new Date()
        }
        
        if (waterReading !== undefined && waterReading !== null && !isNaN(parseFloat(waterReading))) {
          const value = parseFloat(waterReading)
          updateData.initialWaterReading = value
          updateData.lastWaterReading = value
        }
        
        if (electricityReading !== undefined && electricityReading !== null && !isNaN(parseFloat(electricityReading))) {
          const value = parseFloat(electricityReading)
          updateData.initialElectricityReading = value
          updateData.lastElectricityReading = value
        }
        
        if (recordDate) {
          updateData.initialMeterDate = recordDate
          updateData.lastMeterReadingDate = recordDate
        }
        
        await db.collection('rooms').doc(roomId).update({
          data: updateData
        })

        const meterTime = recordDate ? new Date(recordDate) : new Date()
        const safeMeterTime = isNaN(meterTime.getTime()) ? new Date() : meterTime
        const readingMonth = `${safeMeterTime.getFullYear()}-${String(safeMeterTime.getMonth() + 1).padStart(2, '0')}`

        const meterBase = {
          roomId,
          landlordId: openId,
          readingMonth,
          recordDate: recordDate || safeMeterTime,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        const meterRecords = []

        if (waterReading !== undefined && waterReading !== null && !isNaN(parseFloat(waterReading))) {
          const value = parseFloat(waterReading)
          const prevWaterReading = roomResult.data.lastWaterReading || 0
          meterRecords.push({
            ...meterBase,
            meterType: 'water',
            waterReading: value,
            prevWaterReading,
            waterUsage: Math.max(0, value - prevWaterReading),
            isBilled: true // 初始化读数视为已开单
          })
        }

        if (electricityReading !== undefined && electricityReading !== null && !isNaN(parseFloat(electricityReading))) {
          const value = parseFloat(electricityReading)
          const prevElectricityReading = roomResult.data.lastElectricityReading || 0
          meterRecords.push({
            ...meterBase,
            meterType: 'electricity',
            electricityReading: value,
            prevElectricityReading,
            electricityUsage: Math.max(0, value - prevElectricityReading),
            isBilled: true // 初始化读数视为已开单
          })
        }

        if (meterRecords.length > 0) {
          await Promise.all(meterRecords.map(data => db.collection('meter').add({ data })))
        }
        
        if (roomResult.data.buildingId) {
          await db.collection('buildings').doc(roomResult.data.buildingId).update({
            data: {
              updatedAt: new Date()
            }
          }).catch(() => {})
        }
        
        success.push({ roomId })
      } catch (error) {
        console.error('设置初始抄表失败', { record, error })
        errors.push({ roomId: record.roomId, error: error.message })
      }
    }
    
    console.log('批量初始抄表完成', {
      buildingId,
      successCount: success.length,
      errorCount: errors.length
    })
    
    return {
      code: 200,
      message: '初始抄表设置完成',
      data: {
        successCount: success.length,
        errorCount: errors.length,
        errors
      }
    }
    
  } catch (error) {
    console.error('批量设置初始抄表失败', error)
    throw error
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
 * @param {string} params.meterType - 抄表类型 water/electricity
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
      meterType,
      waterReading,
      electricityReading,
      recordDate
    } = params;

    if (!roomId || !year || !month) {
      return { code: 400, message: '参数不完整' };
    }

    if (meterType !== 'water' && meterType !== 'electricity') {
      return { code: 400, message: '抄表类型不能为空' };
    }

    const readingValue = meterType === 'water' ? waterReading : electricityReading;
    if (readingValue === undefined || readingValue === null || isNaN(parseFloat(readingValue))) {
      return { code: 400, message: '读数无效' };
    }

    const room = await db.collection('rooms').doc(roomId).get();
    if (!room.data || room.data.landlordId !== openId) {
      return { code: 403, message: '没有权限操作该房间' };
    }

    const readingMonth = `${year}-${String(month).padStart(2, '0')}`;

    // 获取最近的一条已开单记录（如果没有，则为null）
    const lastBilledRecordResult = await db.collection('meter').where({
      roomId: roomId,
      meterType: meterType,
      landlordId: openId,
      isBilled: true
    }).orderBy('recordDate', 'desc').orderBy('createdAt', 'desc').limit(1).get();

    const lastBilledRecord = lastBilledRecordResult.data.length > 0 ? lastBilledRecordResult.data[0] : null;

    const prevWaterReading = lastBilledRecord && lastBilledRecord.waterReading !== undefined
      ? lastBilledRecord.waterReading
      : (room.data.lastWaterReading || 0);
    const prevElectricityReading = lastBilledRecord && lastBilledRecord.electricityReading !== undefined
      ? lastBilledRecord.electricityReading
      : (room.data.lastElectricityReading || 0);

    // 获取最近的一条记录（用来判断是否已开单，如果未开单则覆盖该记录）
    const lastRecordResult = await db.collection('meter').where({
      roomId: roomId,
      meterType: meterType,
      landlordId: openId
    }).orderBy('recordDate', 'desc').orderBy('createdAt', 'desc').limit(1).get();
    
    const lastRecord = lastRecordResult.data.length > 0 ? lastRecordResult.data[0] : null;

    const existingUnbilledRecord = (lastRecord && !lastRecord.isBilled) ? lastRecord : null;

    const meterTime = recordDate ? new Date(recordDate) : new Date();
    const safeMeterTime = isNaN(meterTime.getTime()) ? new Date() : meterTime;

    const meterData = {
      ...(existingUnbilledRecord || {}),
      roomId: roomId,
      readingMonth: readingMonth,
      landlordId: openId,
      meterType: meterType,
      recordDate: recordDate || safeMeterTime,
      updatedAt: new Date(),
      isBilled: false
    };

    if (meterType === 'water') {
      const value = parseFloat(readingValue);
      meterData.waterReading = value;
      meterData.prevWaterReading = prevWaterReading;
      meterData.waterUsage = Math.max(0, value - prevWaterReading);
    } else {
      const value = parseFloat(readingValue);
      meterData.electricityReading = value;
      meterData.prevElectricityReading = prevElectricityReading;
      meterData.electricityUsage = Math.max(0, value - prevElectricityReading);
    }

    if (existingUnbilledRecord && existingUnbilledRecord._id) {
      delete meterData._id;
      await db.collection('meter').doc(existingUnbilledRecord._id).update({ data: meterData });
      meterData.id = existingUnbilledRecord._id;
    } else {
      meterData.createdAt = new Date();
      const result = await db.collection('meter').add({ data: meterData });
      meterData.id = result._id;
    }

    let billResult = null;
    // 采用快照开单模式，此处不再自动生成账单
    // if (room.data.status === 2) {
    //   try {
    //     billResult = await generateBillFromMeter({ roomId, readingMonth }, openId);
    //   } catch (billError) {
    //     console.error('自动生成账单失败:', billError);
    //   }
    // }

    return {
      code: 200,
      message: '抄表记录成功',
      data: {
        id: meterData.id,
        waterUsage: meterData.waterUsage,
        electricityUsage: meterData.electricityUsage,
        billGenerated: false,
        billId: null,
        totalAmount: null,
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
    
    const meterType = meter.data.meterType
    const updateData = { updatedAt: new Date() }
    let waterUsage
    let electricityUsage

    if (meterType === 'water') {
      const value = parseFloat(waterReading)
      if (isNaN(value)) {
        return { code: 400, message: '水表读数无效' }
      }
      waterUsage = Math.max(0, value - (meter.data.prevWaterReading || 0))
      updateData.waterReading = value
      updateData.waterUsage = waterUsage
    } else if (meterType === 'electricity') {
      const value = parseFloat(electricityReading)
      if (isNaN(value)) {
        return { code: 400, message: '电表读数无效' }
      }
      electricityUsage = Math.max(0, value - (meter.data.prevElectricityReading || 0))
      updateData.electricityReading = value
      updateData.electricityUsage = electricityUsage
    } else {
      waterUsage = Math.max(0, parseFloat(waterReading) - meter.data.prevWaterReading)
      electricityUsage = Math.max(0, parseFloat(electricityReading) - meter.data.prevElectricityReading)
      updateData.waterReading = parseFloat(waterReading)
      updateData.electricityReading = parseFloat(electricityReading)
      updateData.waterUsage = waterUsage
      updateData.electricityUsage = electricityUsage
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
      meterType,
      page = 1,
      pageSize = 20
    } = params
    
    const skip = (page - 1) * pageSize
    
    // 构建查询条件
    const whereCondition = {
      landlordId: openId
    }
    
    // 如果有 roomId，优先按房间筛选
    if (roomId) {
      whereCondition.roomId = roomId
    } else if (buildingId) {
      // 如果没有 roomId 但有 buildingId，先获取该楼栋下的所有房间 ID
      const roomsResult = await db.collection('rooms').where({
        buildingId: buildingId,
        landlordId: openId,
        isDeleted: false
      }).field({ _id: true }).get()
      
      const roomIds = roomsResult.data.map(r => r._id)
      if (roomIds.length > 0) {
        whereCondition.roomId = _.in(roomIds)
      } else {
        // 该楼栋没有房间，直接返回空结果
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
    
    // 添加月份范围筛选
    if (startMonth && endMonth) {
      whereCondition.readingMonth = _.gte(startMonth).and(_.lte(endMonth))
    }

    if (meterType) {
      whereCondition.meterType = meterType
    }
    
    let query = db.collection('meter').where(whereCondition)
    
    // 获取总数
    const countResult = await query.count()
    const total = countResult.total
    
    // 获取数据
    const result = await query
      .orderBy('recordDate', 'desc')
      .orderBy('updatedAt', 'desc')
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
      meterType: item.meterType || '',
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
 * @param {string} openId - 用户openId
 */
async function generateBillFromMeter(params, openId) {
  try {
    const { roomId, readingMonth } = params
    
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
    
    const waterRecordResult = await db.collection('meter').where({
      roomId: roomId,
      meterType: 'water',
      landlordId: openId
    }).orderBy('updatedAt', 'desc').limit(1).get()

    const electricityRecordResult = await db.collection('meter').where({
      roomId: roomId,
      meterType: 'electricity',
      landlordId: openId
    }).orderBy('updatedAt', 'desc').limit(1).get()

    const waterRecord = waterRecordResult.data[0] || null
    const electricityRecord = electricityRecordResult.data[0] || null

    const waterPrevReading = waterRecord && waterRecord.prevWaterReading !== undefined
      ? waterRecord.prevWaterReading
      : (roomData.lastWaterReading || 0)
    const electricityPrevReading = electricityRecord && electricityRecord.prevElectricityReading !== undefined
      ? electricityRecord.prevElectricityReading
      : (roomData.lastElectricityReading || 0)

    const waterUsage = waterRecord
      ? (waterRecord.waterUsage !== undefined
        ? waterRecord.waterUsage
        : Math.max(0, (waterRecord.waterReading || 0) - waterPrevReading))
      : 0
    const electricityUsage = electricityRecord
      ? (electricityRecord.electricityUsage !== undefined
        ? electricityRecord.electricityUsage
        : Math.max(0, (electricityRecord.electricityReading || 0) - electricityPrevReading))
      : 0
    
    // 计算费用
    const rentAmount = roomData.monthlyRent || 0
    const waterAmount = waterUsage * (roomData.waterPrice || 0)
    const electricityAmount = electricityUsage * (roomData.electricityPrice || 0)
    const cleaningAmount = roomData.cleaningFee || roomData.sanitationFee || 0
    const totalAmount = rentAmount + waterAmount + electricityAmount + cleaningAmount
    
    // 生成账单编号
    const roomIdSuffix = roomId.slice(-4)
    const billNo = `B${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${roomIdSuffix}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
    
    const snapshot = {
      roomName: roomData.roomName,
      buildingName: roomData.buildingName || '',
      tenantName: roomData.tenantName || '',
      waterPrice: roomData.waterPrice || 0,
      electricityPrice: roomData.electricityPrice || 0,
      monthlyRent: rentAmount
    }

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
      meterReadingId: waterRecord ? waterRecord._id : '',
      waterMeterReadingId: waterRecord ? waterRecord._id : '',
      electricityMeterReadingId: electricityRecord ? electricityRecord._id : '',
      waterUsage: waterUsage,
      electricityUsage: electricityUsage,
      status: 1, // 待支付
      paidAmount: 0,
      landlordId: openId,
      createdAt: new Date(),
      updatedAt: new Date(),
      snapshot: snapshot
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
    
    // 获取指定月份的抄表记录（分水/电）
    const meterRecord = await db.collection('meter').where({
      roomId: roomId,
      readingMonth: readingMonth,
      meterType: _.in(['water', 'electricity'])
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
          waterReading: meterRecord.data.find(item => item.meterType === 'water')?.waterReading,
          electricityReading: meterRecord.data.find(item => item.meterType === 'electricity')?.electricityReading,
          waterUsage: meterRecord.data.find(item => item.meterType === 'water')?.waterUsage,
          electricityUsage: meterRecord.data.find(item => item.meterType === 'electricity')?.electricityUsage,
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
      meterType: _.in(['water', 'electricity']),
      landlordId: openId
    }).get()
    
    const recordMap = {}
    result.data.forEach(record => {
      if (!recordMap[record.roomId]) {
        recordMap[record.roomId] = {}
      }
      recordMap[record.roomId][record.meterType] = record
    })

    const records = roomIds.map(roomId => {
      const waterRecord = recordMap[roomId]?.water
      const electricityRecord = recordMap[roomId]?.electricity
      return {
        roomId,
        waterReading: waterRecord?.waterReading,
        electricityReading: electricityRecord?.electricityReading,
        waterUsage: waterRecord?.waterUsage,
        electricityUsage: electricityRecord?.electricityUsage,
        recordDate: waterRecord?.recordDate || electricityRecord?.recordDate
      }
    })
    
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
        // 生成账单
        const billResult = await generateBillFromMeter({
          roomId: roomId,
          readingMonth: readingMonth
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
