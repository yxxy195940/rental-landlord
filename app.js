// app.js
/**
 * 小程序应用入口文件
 * 
 * 这是微信小程序的主入口文件，包含：
 * 1. 应用生命周期函数
 * 2. 全局配置和初始化
 * 3. 全局数据和方法
 * 4. 错误处理
 */

// 已移除 MobX 依赖，使用原生小程序数据管理

// 全局应用实例
App({
  /**
   * 应用启动时触发
   * 只会触发一次，可以在此获取用户信息，初始化数据等
   */
  onLaunch() {
    console.log('房租管理小程序启动')
    
    // 初始化应用（必须先初始化globalData）
    this.initApp()
    
    // 检查微信版本
    this.checkWechatVersion()
    
    // 检查登录状态
    this.checkLoginStatus()
  },

  /**
   * 应用显示时触发
   * 从后台切换到前台时会触发
   */
  onShow() {
    console.log('应用显示')
    
    // 检查网络状态
    this.checkNetworkStatus()
    
    // 刷新登录状态
    this.refreshLoginStatus()
  },

  /**
   * 应用隐藏时触发
   * 从前台切换到后台时会触发
   */
  onHide() {
    console.log('应用隐藏')
    
    // 保存重要数据
    this.saveImportantData()
  },

  /**
   * 应用发生错误时触发
   * @param {string} msg - 错误信息
   * @param {string} file - 错误文件
   * @param {number} line - 错误行号
   * @param {number} col - 错误列号
   * @param {object} error - 错误对象
   */
  onError(msg, file, line, col, error) {
    console.error('应用发生错误:', {
      msg,
      file,
      line,
      col,
      error
    })
    
    // 错误上报
    this.reportError({
      msg,
      file,
      line,
      col,
      error,
      userInfo: this.globalData.userInfo,
      timestamp: Date.now()
    })
  },

  /**
   * 检查微信版本
   */
  checkWechatVersion() {
    const systemInfo = wx.getSystemInfoSync()
    console.log('系统信息:', systemInfo)
    
    // 检查基础库版本
    if (this.compareVersion(systemInfo.SDKVersion, '2.19.4') < 0) {
      wx.showModal({
        title: '提示',
        content: '当前微信版本过低，部分功能可能无法正常使用，请升级微信版本。',
        showCancel: false
      })
    }
    
    // 存储系统信息
    this.globalData.systemInfo = systemInfo
  },

  /**
   * 初始化应用
   */
  initApp() {
    // 初始化云开发
    this.initCloudFunction()
    
    // 初始化全局数据
    this.globalData = {
      userInfo: null,           // 用户信息
      token: '',                // 登录令牌
      systemInfo: null,         // 系统信息
      networkStatus: 'wifi',    // 网络状态
      isLogin: false,           // 登录状态
      landlordInfo: null,       // 房东信息
      selectedRoom: null,       // 当前选中的房间
      cacheData: {              // 缓存数据
        roomList: [],
        billList: [],
        meterRecords: []
      }
    }
    
    // 从本地存储恢复数据
    this.restoreDataFromStorage()
    
    // 初始化Toast组件
    this.initToast()
    
    console.log('应用初始化完成')
  },

  /**
   * 初始化云开发
   */
  initCloudFunction() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    
    // 初始化云开发
    wx.cloud.init({
      env: 'cloud1-2gy34tuh656ffa81', // 云环境ID，需要在微信开发者工具中创建
      traceUser: true // 是否记录用户访问记录
    })
    
    console.log('云开发初始化完成')
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const token = wx.getStorageSync('token')
    const userInfo = wx.getStorageSync('userInfo')
    
    if (token && userInfo) {
      this.globalData.token = token
      this.globalData.userInfo = userInfo
      this.globalData.isLogin = true
      
      console.log('用户已登录:', userInfo)
      
      // 验证token有效性
      this.validateToken()
    } else {
      console.log('用户未登录')
      this.globalData.isLogin = false
    }
  },

  /**
   * 处理登录
   */
  handleLogin() {
    wx.showModal({
      title: '登录提示',
      content: '您尚未登录，是否立即登录？',
      success: (res) => {
        if (res.confirm) {
          this.login()
        }
      }
    })
  },

  /**
   * 登录
   */
  login() {
    wx.login({
      success: (res) => {
        if (res.code) {
          // 调用云函数获取openid
          wx.cloud.callFunction({
            name: 'user',
            data: {
              type: 'getOpenId'
            },
            success: (res) => {
              const { openid } = res.result
              this.globalData.userInfo = { ...this.globalData.userInfo, openid }
              wx.setStorageSync('userInfo', this.globalData.userInfo)
              this.globalData.isLogin = true
              this.showToast('登录成功')
            },
            fail: (err) => {
              console.error('获取openid失败:', err)
              this.showToast('登录失败')
            }
          })
        } else {
          console.error('登录失败！' + res.errMsg)
          this.showToast('登录失败')
        }
      }
    })
  },

  /**
   * 获取用户信息
   */
  getUserProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善会员资料',
        success: (res) => {
          this.globalData.userInfo = { ...this.globalData.userInfo, ...res.userInfo }
          wx.setStorageSync('userInfo', this.globalData.userInfo)
          resolve(res.userInfo)
        },
        fail: (err) => {
          console.error('获取用户信息失败:', err)
          reject(err)
        }
      })
    })
  },

  /**
   * 刷新登录状态
   */
  refreshLoginStatus() {
    if (this.globalData.isLogin) {
      // 刷新token
      this.refreshToken()
    }
  },

  /**
   * 检查网络状态
   */
  checkNetworkStatus() {
    wx.getNetworkType({
      success: (res) => {
        this.globalData.networkStatus = res.networkType
        console.log('网络状态:', res.networkType)
        
        if (res.networkType === 'none') {
          wx.showToast({
            title: '网络连接失败',
            icon: 'none',
            duration: 2000
          })
        }
      }
    })
  },

  /**
   * 从本地存储恢复数据
   */
  restoreDataFromStorage() {
    try {
      // 恢复房东信息
      const landlordInfo = wx.getStorageSync('landlordInfo')
      if (landlordInfo) {
        this.globalData.landlordInfo = landlordInfo
      }
      
      // 恢复缓存数据
      const cacheData = wx.getStorageSync('cacheData')
      if (cacheData) {
        this.globalData.cacheData = { ...this.globalData.cacheData, ...cacheData }
      }
      
      console.log('数据恢复完成')
    } catch (error) {
      console.error('数据恢复失败:', error)
    }
  },

  /**
   * 保存重要数据
   */
  saveImportantData() {
    try {
      // 保存房东信息
      if (this.globalData.landlordInfo) {
        wx.setStorageSync('landlordInfo', this.globalData.landlordInfo)
      }
      
      // 保存缓存数据
      wx.setStorageSync('cacheData', this.globalData.cacheData)
      
      console.log('重要数据保存完成')
    } catch (error) {
      console.error('数据保存失败:', error)
    }
  },

  /**
   * 验证token有效性
   */
  validateToken() {
    // 这里可以调用后端接口验证token
    // 如果token无效，则清除登录状态
    console.log('验证token有效性')
  },

  /**
   * 刷新token
   */
  refreshToken() {
    // 这里可以调用后端接口刷新token
    console.log('刷新token')
  },

  /**
   * 初始化Toast组件
   */
  initToast() {
    // 全局Toast方法
    this.showToast = (options) => {
      if (typeof options === 'string') {
        wx.showToast({
          title: options,
          icon: 'none',
          duration: 2000
        })
      } else {
        wx.showToast({
          title: options.title || '操作成功',
          icon: options.icon || 'none',
          duration: options.duration || 2000
        })
      }
    }
    
    // 全局Loading方法
    this.showLoading = (title = '加载中...') => {
      wx.showLoading({
        title: title,
        mask: true
      })
    }
    
    this.hideLoading = () => {
      wx.hideLoading()
    }
  },

  /**
   * 错误上报
   * @param {object} errorInfo - 错误信息
   */
  reportError(errorInfo) {
    // 这里可以上报错误到后端或第三方服务
    console.log('错误上报:', errorInfo)
  },

  /**
   * 版本比较
   * @param {string} v1 - 版本1
   * @param {string} v2 - 版本2
   * @returns {number} - 比较结果
   */
  compareVersion(v1, v2) {
    const v1Array = v1.split('.').map(Number)
    const v2Array = v2.split('.').map(Number)
    const maxLength = Math.max(v1Array.length, v2Array.length)
    
    for (let i = 0; i < maxLength; i++) {
      const num1 = v1Array[i] || 0
      const num2 = v2Array[i] || 0
      
      if (num1 > num2) return 1
      if (num1 < num2) return -1
    }
    
    return 0
  },

  /**
   * 工具方法：格式化金额
   * @param {number} amount - 金额
   * @returns {string} - 格式化后的金额
   */
  formatMoney(amount) {
    if (typeof amount !== 'number') {
      return '0.00'
    }
    return amount.toFixed(2)
  },

  /**
   * 工具方法：格式化日期
   * @param {Date|string|number} date - 日期
   * @param {string} format - 格式
   * @returns {string} - 格式化后的日期
   */
  formatDate(date, format = 'YYYY-MM-DD') {
    if (!date) return ''
    
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    const second = String(d.getSeconds()).padStart(2, '0')
    
    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hour)
      .replace('mm', minute)
      .replace('ss', second)
  },

  /**
   * 工具方法：防抖函数
   * @param {function} func - 要防抖的函数
   * @param {number} wait - 等待时间
   * @returns {function} - 防抖后的函数
   */
  debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func.apply(this, args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  },

  /**
   * 工具方法：节流函数
   * @param {function} func - 要节流的函数
   * @param {number} limit - 限制时间
   * @returns {function} - 节流后的函数
   */
  throttle(func, limit) {
    let lastFunc
    let lastRan
    return function executedFunction(...args) {
      if (!lastRan) {
        func.apply(this, args)
        lastRan = Date.now()
      } else {
        clearTimeout(lastFunc)
        lastFunc = setTimeout(() => {
          if ((Date.now() - lastRan) >= limit) {
            func.apply(this, args)
            lastRan = Date.now()
          }
        }, limit - (Date.now() - lastRan))
      }
    }
  }
})