// cloudfunctions/building/index.js
/**
 * 楼栋管理云函数
 * 
 * 提供楼栋相关的所有操作，包括：
 * 1. 获取楼栋列表
 * 2. 创建楼栋
 * 3. 更新楼栋信息
 * 4. 删除楼栋
 */

const cloud = require('wx-server-sdk')

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 获取数据库引用
const db = cloud.database()

/**
 * 云函数主入口
 * @param {Object} event - 事件参数
 * @param {string} event.action - 操作类型
 * @param {Object} context - 云函数上下文
 */
exports.main = async (event, context) => {
  const { action, ...params } = event
  const { OPENID, APPID, UNIONID } = cloud.getWXContext()
  
  console.log('楼栋云函数调用', {
    action,
    params,
    openId: OPENID,
    timestamp: new Date().toISOString()
  })
  
  try {
    // 根据action分发到不同的处理函数
    switch (action) {
      case 'list':
        return await getBuildingList(params, OPENID)
      case 'detail':
        return await getBuildingDetail(params, OPENID)
      case 'create':
        return await createBuilding(params, OPENID)
      case 'update':
        return await updateBuilding(params, OPENID)
      case 'delete':
      case 'batchDelete':
        return await deleteBuilding(params, OPENID)
      default:
        return {
          code: 400,
          message: `未知的操作类型: ${action}`,
          data: null
        }
    }
  } catch (error) {
    console.error('楼栋云函数执行失败', {
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
 * 获取楼栋列表
 * @param {Object} params - 查询参数
 * @param {string} openId - 用户openId
 */
async function getBuildingList(params, openId) {
  try {
    console.log('获取楼栋列表', { openId })
    
    // 查询当前房东的所有楼栋
    const result = await db.collection('buildings')
      .where({
        landlordId: openId,
        isDeleted: false
      })
      .orderBy('createdAt', 'desc')
      .get()
    
    const buildingList = result.data.map(building => ({
      id: building._id,
      name: building.name,
      address: building.address,
      floors: building.floors,
      roomCount: building.roomCount || 0,
      createdAt: building.createdAt,
      updatedAt: building.updatedAt
    }))
    
    console.log('楼栋列表查询成功', {
      count: buildingList.length,
      openId
    })
    
    return {
      code: 200,
      message: 'success',
      data: {
        list: buildingList,
        total: buildingList.length
      }
    }
    
  } catch (error) {
    console.error('获取楼栋列表失败', error)
    throw error
  }
}

/**
 * 获取楼栋详情
 * @param {Object} params - 参数
 * @param {string} params.buildingId - 楼栋ID
 * @param {string} openId - 用户openId
 */
async function getBuildingDetail(params, openId) {
  try {
    const { buildingId } = params
    
    if (!buildingId) {
      return {
        code: 400,
        message: '楼栋ID不能为空',
        data: null
      }
    }
    
    const result = await db.collection('buildings')
      .doc(buildingId)
      .get()
    
    if (!result.data) {
      return {
        code: 404,
        message: '楼栋不存在',
        data: null
      }
    }
    
    const building = result.data
    
    // 检查权限：只能查看自己的楼栋
    if (building.landlordId !== openId) {
      return {
        code: 403,
        message: '没有权限访问该楼栋',
        data: null
      }
    }
    
    const buildingDetail = {
      id: building._id,
      name: building.name,
      address: building.address,
      floors: building.floors,
      roomCount: building.roomCount || 0,
      createdAt: building.createdAt,
      updatedAt: building.updatedAt
    }
    
    return {
      code: 200,
      message: 'success',
      data: buildingDetail
    }
    
  } catch (error) {
    console.error('获取楼栋详情失败', error)
    throw error
  }
}

/**
 * 创建楼栋
 * @param {Object} params - 楼栋信息
 * @param {string} openId - 用户openId
 */
async function createBuilding(params, openId) {
  try {
    const buildingData = params.buildingData || params
    const { name, address, floors } = buildingData
    
    // 参数验证
    if (!name) {
      return {
        code: 400,
        message: '楼栋名称不能为空',
        data: null
      }
    }
    
    // 检查楼栋名称是否重复
    const existBuilding = await db.collection('buildings')
      .where({
        landlordId: openId,
        name: name,
        isDeleted: false
      })
      .get()
    
    if (existBuilding.data.length > 0) {
      return {
        code: 400,
        message: '楼栋名称已存在',
        data: null
      }
    }
    
    // 构建楼栋数据
    const newBuildingData = {
      landlordId: openId,
      name: name,
      address: address || '',
      floors: parseInt(floors) || 1,
      roomCount: 0,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const result = await db.collection('buildings').add({
      data: newBuildingData
    })
    
    console.log('楼栋创建成功', {
      buildingId: result._id,
      name,
      landlordId: openId
    })
    
    return {
      code: 200,
      message: '楼栋创建成功',
      data: {
        id: result._id,
        ...newBuildingData
      }
    }
    
  } catch (error) {
    console.error('创建楼栋失败', error)
    throw error
  }
}

/**
 * 更新楼栋信息
 * @param {Object} params - 更新参数
 * @param {string} openId - 用户openId
 */
async function updateBuilding(params, openId) {
  try {
    const { buildingId, buildingData } = params;
    
    if (!buildingId) {
      return { code: 400, message: '楼栋ID不能为空' };
    }
    
    const building = await db.collection('buildings').doc(buildingId).get();
    
    if (!building.data) {
      return { code: 404, message: '楼栋不存在' };
    }
    
    if (building.data.landlordId !== openId) {
      return { code: 403, message: '没有权限修改该楼栋' };
    }
    
    const updateFields = {
      updatedAt: new Date()
    };
    
    if (buildingData.name !== undefined) updateFields.name = buildingData.name;
    if (buildingData.address !== undefined) updateFields.address = buildingData.address;
    if (buildingData.floors !== undefined) updateFields.floors = parseInt(buildingData.floors) || 1;
    
    const result = await db.collection('buildings').doc(buildingId).update({
      data: updateFields
    });
    
    console.log('楼栋更新成功', { buildingId, updateFields, landlordId: openId });
    
    return {
      code: 200,
      message: '楼栋更新成功',
      data: { id: buildingId, updated: result.stats.updated }
    };
    
  } catch (error) {
    console.error('更新楼栋失败', error);
    throw error;
  }
}

/**
 * 删除楼栋（支持批量）
 * @param {Object} params - 参数
 * @param {string[]} params.buildingIds - 要删除的楼栋ID数组
 * @param {string} openId - 用户openId
 */
async function deleteBuilding(params, openId) {
  const { buildingIds } = params;
  const _ = db.command;

  if (!buildingIds || !Array.isArray(buildingIds) || buildingIds.length === 0) {
    return { code: 400, message: '楼栋ID列表不能为空' };
  }

  console.log('开始删除楼栋', { buildingIds, openId });

  try {
    // 1. 验证权限
    const buildingsSnapshot = await db.collection('buildings').where({
      _id: _.in(buildingIds),
      landlordId: openId
    }).get();

    if (buildingsSnapshot.data.length !== buildingIds.length) {
      return { code: 403, message: '包含无权限操作或不存在的楼栋' };
    }

    // 2. 软删除所有相关房间
    const roomsUpdateResult = await db.collection('rooms').where({
      buildingId: _.in(buildingIds),
      landlordId: openId
    }).update({
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log(`软删除了 ${roomsUpdateResult.stats.updated} 个关联房间`);

    // 3. 软删除楼栋
    const buildingsUpdateResult = await db.collection('buildings').where({
      _id: _.in(buildingIds)
    }).update({
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log(`软删除了 ${buildingsUpdateResult.stats.updated} 个楼栋`);

    return {
      code: 200,
      message: '删除成功',
      data: {
        deletedBuildings: buildingsUpdateResult.stats.updated,
        deletedRooms: roomsUpdateResult.stats.updated
      }
    };

  } catch (error) {
    console.error('删除楼栋失败', error);
    throw error;
  }
}
