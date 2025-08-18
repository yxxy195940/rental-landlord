// utils/api.js
/**
 * API 接口封装
 * 
 * 封装所有后端接口调用，提供统一的接口管理，包括：
 * 1. 用户认证相关接口
 * 2. 房间管理相关接口
 * 3. 账单管理相关接口
 * 4. 抄表相关接口
 * 5. 文件上传接口
 * 6. 统计数据接口
 */

import request from './request'

/**
 * 用户认证相关接口
 */
export const authAPI = {
  /**
   * 手机号密码登录
   * @param {Object} data - 登录数据
   * @param {string} data.phone - 手机号
   * @param {string} data.password - 密码
   * @returns {Promise} - 登录结果
   */
  login(data) {
    return request.post('/api/auth/login', {
      phone: data.phone,
      password: data.password
    })
  },

  /**
   * 微信小程序登录
   * @param {Object} data - 登录数据
   * @param {string} data.code - 微信授权码
   * @param {string} data.encryptedData - 加密数据
   * @param {string} data.iv - 初始向量
   * @returns {Promise} - 登录结果
   */
  wxLogin(data) {
    return request.post('/api/auth/wx-login', {
      code: data.code,
      encryptedData: data.encryptedData,
      iv: data.iv
    })
  },

  /**
   * 刷新token
   * @returns {Promise} - 新的token
   */
  refreshToken() {
    return request.post('/api/auth/refresh')
  },

  /**
   * 退出登录
   * @returns {Promise} - 退出结果
   */
  logout() {
    return request.post('/api/auth/logout')
  },

  /**
   * 获取用户信息
   * @returns {Promise} - 用户信息
   */
  getUserInfo() {
    return request.get('/api/auth/profile')
  },

  /**
   * 更新用户信息
   * @param {Object} data - 用户信息
   * @returns {Promise} - 更新结果
   */
  updateUserInfo(data) {
    return request.put('/api/auth/profile', data)
  },

  /**
   * 修改密码
   * @param {Object} data - 密码数据
   * @param {string} data.oldPassword - 旧密码
   * @param {string} data.newPassword - 新密码
   * @returns {Promise} - 修改结果
   */
  changePassword(data) {
    return request.put('/api/auth/password', {
      oldPassword: data.oldPassword,
      newPassword: data.newPassword
    })
  }
}

/**
 * 房间管理相关接口
 */
export const roomAPI = {
  /**
   * 获取房间列表
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页大小
   * @param {string} params.keyword - 搜索关键词
   * @param {number} params.status - 房间状态
   * @returns {Promise} - 房间列表
   */
  getRoomList(params = {}) {
    return request.get('/api/rooms', params)
  },

  /**
   * 获取房间详情
   * @param {string|number} roomId - 房间ID
   * @returns {Promise} - 房间详情
   */
  getRoomDetail(roomId) {
    return request.get(`/api/rooms/${roomId}`)
  },

  /**
   * 创建房间
   * @param {Object} data - 房间数据
   * @returns {Promise} - 创建结果
   */
  createRoom(data) {
    return request.post('/api/rooms', {
      roomNumber: data.roomNumber,
      location: data.location,
      monthlyRent: data.monthlyRent,
      deposit: data.deposit,
      area: data.area,
      facilities: data.facilities,
      description: data.description,
      images: data.images
    })
  },

  /**
   * 更新房间信息
   * @param {string|number} roomId - 房间ID
   * @param {Object} data - 房间数据
   * @returns {Promise} - 更新结果
   */
  updateRoom(roomId, data) {
    return request.put(`/api/rooms/${roomId}`, data)
  },

  /**
   * 删除房间
   * @param {string|number} roomId - 房间ID
   * @returns {Promise} - 删除结果
   */
  deleteRoom(roomId) {
    return request.delete(`/api/rooms/${roomId}`)
  },

  /**
   * 快速出租房间
   * @param {string|number} roomId - 房间ID
   * @param {Object} data - 租客信息
   * @param {string} data.tenantName - 租客姓名
   * @param {string} data.tenantPhone - 租客手机号
   * @param {string} data.tenantIdCard - 租客身份证号
   * @param {string} data.contractStartDate - 合同开始日期
   * @param {string} data.contractEndDate - 合同结束日期
   * @param {number} data.monthlyRent - 月租金
   * @param {number} data.deposit - 押金
   * @returns {Promise} - 出租结果
   */
  quickRent(roomId, data) {
    return request.post(`/api/rooms/${roomId}/rent`, {
      tenantName: data.tenantName,
      tenantPhone: data.tenantPhone,
      tenantIdCard: data.tenantIdCard,
      contractStartDate: data.contractStartDate,
      contractEndDate: data.contractEndDate,
      monthlyRent: data.monthlyRent,
      deposit: data.deposit
    })
  },

  /**
   * 退租房间
   * @param {string|number} roomId - 房间ID
   * @param {Object} data - 退租数据
   * @returns {Promise} - 退租结果
   */
  checkOut(roomId, data = {}) {
    return request.post(`/api/rooms/${roomId}/checkout`, data)
  },

  /**
   * 更新房间状态
   * @param {string|number} roomId - 房间ID
   * @param {number} status - 房间状态
   * @returns {Promise} - 更新结果
   */
  updateRoomStatus(roomId, status) {
    return request.put(`/api/rooms/${roomId}/status`, { status })
  }
}

/**
 * 账单管理相关接口
 */
export const billAPI = {
  /**
   * 获取账单列表
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页大小
   * @param {string|number} params.roomId - 房间ID
   * @param {number} params.status - 账单状态
   * @param {string} params.startDate - 开始日期
   * @param {string} params.endDate - 结束日期
   * @returns {Promise} - 账单列表
   */
  getBillList(params = {}) {
    return request.get('/api/bills', params)
  },

  /**
   * 获取账单详情
   * @param {string|number} billId - 账单ID
   * @returns {Promise} - 账单详情
   */
  getBillDetail(billId) {
    return request.get(`/api/bills/${billId}`)
  },

  /**
   * 创建账单
   * @param {Object} data - 账单数据
   * @returns {Promise} - 创建结果
   */
  createBill(data) {
    return request.post('/api/bills', {
      roomId: data.roomId,
      billType: data.billType,
      billDate: data.billDate,
      dueDate: data.dueDate,
      rentAmount: data.rentAmount,
      waterAmount: data.waterAmount,
      electricAmount: data.electricAmount,
      otherAmount: data.otherAmount,
      totalAmount: data.totalAmount,
      description: data.description,
      meterReadings: data.meterReadings
    })
  },

  /**
   * 更新账单
   * @param {string|number} billId - 账单ID
   * @param {Object} data - 账单数据
   * @returns {Promise} - 更新结果
   */
  updateBill(billId, data) {
    return request.put(`/api/bills/${billId}`, data)
  },

  /**
   * 删除账单
   * @param {string|number} billId - 账单ID
   * @returns {Promise} - 删除结果
   */
  deleteBill(billId) {
    return request.delete(`/api/bills/${billId}`)
  },

  /**
   * 标记账单已付
   * @param {string|number} billId - 账单ID
   * @param {Object} data - 付款信息
   * @param {string} data.paymentDate - 付款日期
   * @param {string} data.paymentMethod - 付款方式
   * @param {number} data.paidAmount - 实付金额
   * @param {string} data.remark - 备注
   * @returns {Promise} - 付款结果
   */
  markAsPaid(billId, data) {
    return request.put(`/api/bills/${billId}/pay`, {
      paymentDate: data.paymentDate,
      paymentMethod: data.paymentMethod,
      paidAmount: data.paidAmount,
      remark: data.remark
    })
  },

  /**
   * 生成月度账单
   * @param {Object} data - 生成参数
   * @param {string} data.month - 月份 (YYYY-MM)
   * @param {Array} data.roomIds - 房间ID列表
   * @returns {Promise} - 生成结果
   */
  generateMonthlyBills(data) {
    return request.post('/api/bills/generate-monthly', {
      month: data.month,
      roomIds: data.roomIds
    })
  }
}

/**
 * 抄表相关接口
 */
export const meterAPI = {
  /**
   * 获取抄表记录列表
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页大小
   * @param {string|number} params.roomId - 房间ID
   * @param {string} params.startDate - 开始日期
   * @param {string} params.endDate - 结束日期
   * @returns {Promise} - 抄表记录列表
   */
  getMeterReadings(params = {}) {
    return request.get('/api/meter-readings', params)
  },

  /**
   * 获取房间抄表历史
   * @param {string|number} roomId - 房间ID
   * @param {Object} params - 查询参数
   * @returns {Promise} - 抄表历史
   */
  getRoomMeterHistory(roomId, params = {}) {
    return request.get(`/api/rooms/${roomId}/meter-history`, params)
  },

  /**
   * 批量抄表
   * @param {Array} readings - 抄表数据数组
   * @returns {Promise} - 抄表结果
   */
  batchMeterReading(readings) {
    return request.post('/api/meter-readings/batch', {
      readings: readings.map(reading => ({
        roomId: reading.roomId,
        readingDate: reading.readingDate,
        waterReading: reading.waterReading,
        electricReading: reading.electricReading,
        gasReading: reading.gasReading,
        images: reading.images,
        remark: reading.remark
      }))
    })
  },

  /**
   * 单个房间抄表
   * @param {Object} data - 抄表数据
   * @returns {Promise} - 抄表结果
   */
  createMeterReading(data) {
    return request.post('/api/meter-readings', {
      roomId: data.roomId,
      readingDate: data.readingDate,
      waterReading: data.waterReading,
      electricReading: data.electricReading,
      gasReading: data.gasReading,
      images: data.images,
      remark: data.remark
    })
  },

  /**
   * 更新抄表记录
   * @param {string|number} readingId - 抄表记录ID
   * @param {Object} data - 抄表数据
   * @returns {Promise} - 更新结果
   */
  updateMeterReading(readingId, data) {
    return request.put(`/api/meter-readings/${readingId}`, data)
  },

  /**
   * 删除抄表记录
   * @param {string|number} readingId - 抄表记录ID
   * @returns {Promise} - 删除结果
   */
  deleteMeterReading(readingId) {
    return request.delete(`/api/meter-readings/${readingId}`)
  },

  /**
   * 获取待抄表房间列表
   * @returns {Promise} - 待抄表房间列表
   */
  getPendingMeterRooms() {
    return request.get('/api/meter-readings/pending-rooms')
  }
}

/**
 * 文件上传相关接口
 */
export const uploadAPI = {
  /**
   * 上传单个文件
   * @param {string} filePath - 文件路径
   * @param {Object} options - 上传选项
   * @returns {Promise} - 上传结果
   */
  uploadFile(filePath, options = {}) {
    return request.uploadFile('/api/upload/file', filePath, 'file', {
      type: options.type || 'image',
      category: options.category || 'general'
    })
  },

  /**
   * 上传多个文件
   * @param {Array} filePaths - 文件路径数组
   * @param {Object} options - 上传选项
   * @returns {Promise} - 上传结果
   */
  async uploadMultipleFiles(filePaths, options = {}) {
    const uploadPromises = filePaths.map(filePath => {
      return this.uploadFile(filePath, options)
    })
    
    try {
      const results = await Promise.all(uploadPromises)
      return {
        success: true,
        data: results
      }
    } catch (error) {
      console.error('批量上传文件失败:', error)
      throw error
    }
  },

  /**
   * 上传抄表图片
   * @param {Array} filePaths - 图片路径数组
   * @param {string|number} roomId - 房间ID
   * @returns {Promise} - 上传结果
   */
  uploadMeterImages(filePaths, roomId) {
    return this.uploadMultipleFiles(filePaths, {
      type: 'image',
      category: 'meter',
      roomId: roomId
    })
  },

  /**
   * 上传房间图片
   * @param {Array} filePaths - 图片路径数组
   * @param {string|number} roomId - 房间ID
   * @returns {Promise} - 上传结果
   */
  uploadRoomImages(filePaths, roomId) {
    return this.uploadMultipleFiles(filePaths, {
      type: 'image',
      category: 'room',
      roomId: roomId
    })
  }
}

/**
 * 统计数据相关接口
 */
export const statisticsAPI = {
  /**
   * 获取首页统计数据
   * @returns {Promise} - 统计数据
   */
  getOverviewStatistics() {
    return request.get('/api/statistics/overview')
  },

  /**
   * 获取收租统计
   * @param {Object} params - 查询参数
   * @param {string} params.period - 统计周期 (month/quarter/year)
   * @param {string} params.startDate - 开始日期
   * @param {string} params.endDate - 结束日期
   * @returns {Promise} - 收租统计
   */
  getRentStatistics(params = {}) {
    return request.get('/api/statistics/rent', params)
  },

  /**
   * 获取入住率统计
   * @param {Object} params - 查询参数
   * @returns {Promise} - 入住率统计
   */
  getOccupancyStatistics(params = {}) {
    return request.get('/api/statistics/occupancy', params)
  },

  /**
   * 获取房间状态统计
   * @returns {Promise} - 房间状态统计
   */
  getRoomStatusStatistics() {
    return request.get('/api/statistics/room-status')
  },

  /**
   * 获取最近动态
   * @param {Object} params - 查询参数
   * @param {number} params.limit - 限制数量
   * @returns {Promise} - 最近动态
   */
  getRecentActivities(params = {}) {
    return request.get('/api/activities/recent', params)
  },

  /**
   * 获取待办提醒
   * @returns {Promise} - 待办提醒
   */
  getTodoReminders() {
    return request.get('/api/reminders/todo')
  }
}

/**
 * 系统配置相关接口
 */
export const systemAPI = {
  /**
   * 获取系统配置
   * @returns {Promise} - 系统配置
   */
  getSystemConfig() {
    return request.get('/api/system/config')
  },

  /**
   * 更新系统配置
   * @param {Object} config - 配置数据
   * @returns {Promise} - 更新结果
   */
  updateSystemConfig(config) {
    return request.put('/api/system/config', config)
  },

  /**
   * 获取版本信息
   * @returns {Promise} - 版本信息
   */
  getVersionInfo() {
    return request.get('/api/system/version')
  },

  /**
   * 意见反馈
   * @param {Object} data - 反馈数据
   * @param {string} data.type - 反馈类型
   * @param {string} data.content - 反馈内容
   * @param {Array} data.images - 图片列表
   * @returns {Promise} - 反馈结果
   */
  submitFeedback(data) {
    return request.post('/api/system/feedback', {
      type: data.type,
      content: data.content,
      images: data.images,
      deviceInfo: data.deviceInfo
    })
  }
}

// 导出所有API
export default {
  authAPI,
  roomAPI,
  billAPI,
  meterAPI,
  uploadAPI,
  statisticsAPI,
  systemAPI
}