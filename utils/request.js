// utils/request.js
/**
 * 网络请求工具类
 * 
 * 封装了微信小程序的网络请求功能，包括：
 * 1. 统一的请求配置
 * 2. 自动token处理
 * 3. 请求拦截器和响应拦截器
 * 4. 错误处理
 * 5. 加载状态管理
 * 6. 云函数和API双轨调用支持
 */

import { config, log } from './config'

// 获取应用实例
const app = getApp()

// 接口基础配置
const CONFIG = {
  BASE_URL: 'https://api.rental.com',    // 后端API基础地址
  TIMEOUT: 10000,                        // 请求超时时间(毫秒)
  RETRY_COUNT: 3,                        // 重试次数
  RETRY_DELAY: 1000                      // 重试延迟时间(毫秒)
}

/**
 * 网络请求类
 */
class Request {
  constructor() {
    this.requestCount = 0  // 当前请求数量，用于管理loading状态
  }

  /**
   * 发起网络请求（支持云函数和API双轨调用）
   * @param {Object} options - 请求配置
   * @param {string} options.url - 请求地址（API模式）
   * @param {string} options.cloudFunc - 云函数名称（云函数模式）
   * @param {string} options.method - 请求方法
   * @param {Object} options.data - 请求数据
   * @param {Object} options.header - 请求头
   * @param {boolean} options.loading - 是否显示loading
   * @param {string} options.loadingText - loading文本
   * @param {number} options.timeout - 超时时间
   * @param {number} options.retryCount - 重试次数
   * @returns {Promise} - 返回Promise对象
   */
  request(options) {
    // 根据配置选择调用方式
    if (config.useCloud && options.cloudFunc) {
      log('info', `使用云函数调用: ${options.cloudFunc}`, options.data)
      return this.callCloudFunction(options)
    } else {
      log('info', `使用API调用: ${options.url}`, options.data)
      return this.callApi(options)
    }
  }

  /**
   * 调用云函数
   * @param {Object} options - 请求配置
   * @returns {Promise} - 返回Promise对象
   */
  callCloudFunction(options) {
    return new Promise((resolve, reject) => {
      // 显示loading
      if (options.loading !== false) {
        this.showLoading(options.loadingText || '请求中...')
      }

      // 调用云函数
      wx.cloud.callFunction({
        name: options.cloudFunc,
        data: options.data || {},
        success: (res) => {
          const action = options.data?.action || 'unknown'
          console.log(`✅ 云函数调用成功: ${options.cloudFunc}.${action}`, {
            cloudFunc: options.cloudFunc,
            action: action,
            requestData: options.data,
            response: res
          })
          log('info', `云函数调用成功: ${options.cloudFunc}.${action}`, res)
          
          // 隐藏loading
          if (options.loading !== false) {
            this.hideLoading()
          }
          
          // 处理云函数响应
          this.handleCloudFunctionResponse(res, resolve, reject)
        },
        fail: (error) => {
          const action = options.data?.action || 'unknown'
          console.error(`❌ 云函数调用失败: ${options.cloudFunc}.${action}`, {
            cloudFunc: options.cloudFunc,
            action: action,
            requestData: options.data,
            error: error
          })
          log('error', `云函数调用失败: ${options.cloudFunc}.${action}`, error)
          
          // 隐藏loading
          if (options.loading !== false) {
            this.hideLoading()
          }
          
          // 处理云函数错误
          this.handleCloudFunctionError(error, reject)
        }
      })
    })
  }

  /**
   * 调用传统API
   * @param {Object} options - 请求配置
   * @returns {Promise} - 返回Promise对象
   */
  callApi(options) {
    // 参数预处理
    const requestOptions = this.preprocessOptions(options)
    
    return new Promise((resolve, reject) => {
      // 显示loading
      if (requestOptions.loading) {
        this.showLoading(requestOptions.loadingText)
      }
      
      // 发起请求
      this.executeRequest(requestOptions, resolve, reject, requestOptions.retryCount)
    })
  }

  /**
   * 预处理请求参数
   * @param {Object} options - 原始请求配置
   * @returns {Object} - 处理后的请求配置
   */
  preprocessOptions(options) {
    const defaultOptions = {
      method: 'GET',
      header: {},
      loading: true,
      loadingText: '请求中...',
      timeout: CONFIG.TIMEOUT,
      retryCount: CONFIG.RETRY_COUNT
    }
    
    // 合并配置
    const mergedOptions = Object.assign({}, defaultOptions, options)
    
    // 处理URL
    if (!mergedOptions.url.startsWith('http')) {
      mergedOptions.url = CONFIG.BASE_URL + mergedOptions.url
    }
    
    // 处理请求头
    mergedOptions.header = Object.assign({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }, mergedOptions.header)
    
    // 添加token
    const token = this.getToken()
    if (token) {
      mergedOptions.header['Authorization'] = `Bearer ${token}`
    }
    
    return mergedOptions
  }

  /**
   * 执行网络请求
   * @param {Object} options - 请求配置
   * @param {Function} resolve - 成功回调
   * @param {Function} reject - 失败回调
   * @param {number} retryCount - 剩余重试次数
   */
  executeRequest(options, resolve, reject, retryCount) {
    wx.request({
      url: options.url,
      method: options.method,
      data: options.data,
      header: options.header,
      timeout: options.timeout,
      success: (res) => {
        console.log('请求成功:', {
          url: options.url,
          method: options.method,
          data: options.data,
          response: res
        })
        
        // 隐藏loading
        if (options.loading) {
          this.hideLoading()
        }
        
        // 处理响应
        this.handleResponse(res, resolve, reject)
      },
      fail: (error) => {
        console.error('请求失败:', {
          url: options.url,
          method: options.method,
          data: options.data,
          error: error
        })
        
        // 重试逻辑
        if (retryCount > 0 && this.shouldRetry(error)) {
          console.log(`请求失败，${CONFIG.RETRY_DELAY}ms后重试，剩余${retryCount}次`)
          setTimeout(() => {
            this.executeRequest(options, resolve, reject, retryCount - 1)
          }, CONFIG.RETRY_DELAY)
          return
        }
        
        // 隐藏loading
        if (options.loading) {
          this.hideLoading()
        }
        
        // 处理请求失败
        this.handleRequestError(error, reject)
      },
      complete: () => {
        // 请求完成的通用处理
        this.requestCount = Math.max(0, this.requestCount - 1)
      }
    })
  }

  /**
   * 处理响应数据
   * @param {Object} res - 响应对象
   * @param {Function} resolve - 成功回调
   * @param {Function} reject - 失败回调
   */
  handleResponse(res, resolve, reject) {
    const { statusCode, data } = res
    
    // HTTP状态码检查
    if (statusCode >= 200 && statusCode < 300) {
      // 业务逻辑检查
      if (data && data.code !== undefined) {
        if (data.code === 200 || data.code === 0) {
          // 请求成功
          resolve(data.data || data)
        } else {
          // 业务错误
          this.handleBusinessError(data, reject)
        }
      } else {
        // 直接返回数据
        resolve(data)
      }
    } else {
      // HTTP错误
      this.handleHttpError(res, reject)
    }
  }

  /**
   * 处理业务错误
   * @param {Object} data - 响应数据
   * @param {Function} reject - 失败回调
   */
  handleBusinessError(data, reject) {
    const errorMsg = data.message || data.msg || '请求失败'
    
    // 特殊错误码处理
    switch (data.code) {
      case 401:
        // token过期或无效
        this.handleTokenExpired()
        break
      case 403:
        // 权限不足
        this.showError('权限不足')
        break
      case 404:
        // 接口不存在
        this.showError('接口不存在')
        break
      case 500:
        // 服务器错误
        this.showError('服务器错误，请稍后重试')
        break
      default:
        // 其他业务错误
        this.showError(errorMsg)
        break
    }
    
    reject({
      type: 'business',
      code: data.code,
      message: errorMsg,
      data: data
    })
  }

  /**
   * 处理HTTP错误
   * @param {Object} res - 响应对象
   * @param {Function} reject - 失败回调
   */
  handleHttpError(res, reject) {
    const { statusCode } = res
    let errorMsg = '请求失败'
    
    switch (statusCode) {
      case 400:
        errorMsg = '请求参数错误'
        break
      case 401:
        errorMsg = '未授权访问'
        this.handleTokenExpired()
        break
      case 403:
        errorMsg = '禁止访问'
        break
      case 404:
        errorMsg = '请求地址不存在'
        break
      case 500:
        errorMsg = '服务器内部错误'
        break
      case 502:
        errorMsg = '网关错误'
        break
      case 503:
        errorMsg = '服务不可用'
        break
      default:
        errorMsg = `请求失败(${statusCode})`
        break
    }
    
    this.showError(errorMsg)
    
    reject({
      type: 'http',
      code: statusCode,
      message: errorMsg,
      data: res
    })
  }

  /**
   * 处理请求失败（网络错误等）
   * @param {Object} error - 错误对象
   * @param {Function} reject - 失败回调
   */
  handleRequestError(error, reject) {
    let errorMsg = '网络请求失败'
    
    // 检查网络状态
    wx.getNetworkType({
      success: (res) => {
        if (res.networkType === 'none') {
          errorMsg = '网络连接失败，请检查网络设置'
        }
      }
    })
    
    this.showError(errorMsg)
    
    reject({
      type: 'network',
      message: errorMsg,
      data: error
    })
  }

  /**
   * 处理云函数响应
   * @param {Object} res - 云函数响应
   * @param {Function} resolve - 成功回调
   * @param {Function} reject - 失败回调
   */
  handleCloudFunctionResponse(res, resolve, reject) {
    try {
      const { result } = res
      
      // 检查云函数执行结果
      if (result && result.code !== undefined) {
        if (result.code === 200 || result.code === 0) {
          // 成功
          resolve(result.data || result)
        } else {
          // 业务错误
          this.handleCloudFunctionBusinessError(result, reject)
        }
      } else {
        // 直接返回结果
        resolve(result)
      }
    } catch (error) {
      log('error', '处理云函数响应失败', error)
      reject({
        type: 'parse',
        message: '响应数据解析失败',
        data: error
      })
    }
  }

  /**
   * 处理云函数业务错误
   * @param {Object} result - 云函数结果
   * @param {Function} reject - 失败回调
   */
  handleCloudFunctionBusinessError(result, reject) {
    const errorMsg = result.message || result.msg || '请求失败'
    
    // 显示错误信息
    this.showError(errorMsg)
    
    reject({
      type: 'business',
      code: result.code,
      message: errorMsg,
      data: result
    })
  }

  /**
   * 处理云函数错误
   * @param {Object} error - 错误对象
   * @param {Function} reject - 失败回调
   */
  handleCloudFunctionError(error, reject) {
    let errorMsg = '云函数调用失败'
    
    // 根据错误类型显示不同信息
    if (error.errCode) {
      switch (error.errCode) {
        case -1:
          errorMsg = '系统繁忙，请稍后重试'
          break
        case -2:
          errorMsg = '网络连接失败'
          break
        case -404:
          errorMsg = '云函数不存在'
          break
        default:
          errorMsg = error.errMsg || '云函数调用失败'
      }
    }
    
    this.showError(errorMsg)
    
    reject({
      type: 'cloudFunction',
      code: error.errCode,
      message: errorMsg,
      data: error
    })
  }

  /**
   * 处理token过期
   */
  handleTokenExpired() {
    console.log('token过期，清除登录状态')
    
    // 清除token和用户信息
    wx.removeStorageSync('token')
    wx.removeStorageSync('userInfo')
    
    // 更新应用状态
    if (app.globalData) {
      app.globalData.token = ''
      app.globalData.userInfo = null
      app.globalData.isLogin = false
    }
    
    // 提示用户重新登录
    wx.showModal({
      title: '提示',
      content: '登录已过期，请重新登录',
      showCancel: false,
      success: () => {
        // 跳转到登录页面（这里需要根据实际情况调整）
        wx.reLaunch({
          url: '/pages/login/login'
        })
      }
    })
  }

  /**
   * 判断是否应该重试
   * @param {Object} error - 错误对象
   * @returns {boolean} - 是否应该重试
   */
  shouldRetry(error) {
    // 网络错误或超时错误可以重试
    return error.errMsg && (
      error.errMsg.includes('timeout') ||
      error.errMsg.includes('fail') ||
      error.errMsg.includes('abort')
    )
  }

  /**
   * 获取token
   * @returns {string} - token值
   */
  getToken() {
    return wx.getStorageSync('token') || (app.globalData && app.globalData.token) || ''
  }

  /**
   * 显示loading
   * @param {string} text - loading文本
   */
  showLoading(text = '加载中...') {
    if (this.requestCount === 0) {
      wx.showLoading({
        title: text,
        mask: true
      })
    }
    this.requestCount++
  }

  /**
   * 隐藏loading
   */
  hideLoading() {
    this.requestCount = Math.max(0, this.requestCount - 1)
    if (this.requestCount === 0) {
      wx.hideLoading()
    }
  }

  /**
   * 显示错误提示
   * @param {string} message - 错误信息
   */
  showError(message) {
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2000
    })
  }

  /**
   * GET请求
   * @param {string} url - 请求地址
   * @param {Object} data - 请求参数
   * @param {Object} options - 其他选项
   * @returns {Promise} - 返回Promise对象
   */
  get(url, data = {}, options = {}) {
    return this.request({
      url,
      method: 'GET',
      data,
      ...options
    })
  }

  /**
   * POST请求
   * @param {string} url - 请求地址
   * @param {Object} data - 请求数据
   * @param {Object} options - 其他选项
   * @returns {Promise} - 返回Promise对象
   */
  post(url, data = {}, options = {}) {
    return this.request({
      url,
      method: 'POST',
      data,
      ...options
    })
  }

  /**
   * PUT请求
   * @param {string} url - 请求地址
   * @param {Object} data - 请求数据
   * @param {Object} options - 其他选项
   * @returns {Promise} - 返回Promise对象
   */
  put(url, data = {}, options = {}) {
    return this.request({
      url,
      method: 'PUT',
      data,
      ...options
    })
  }

  /**
   * DELETE请求
   * @param {string} url - 请求地址
   * @param {Object} data - 请求参数
   * @param {Object} options - 其他选项
   * @returns {Promise} - 返回Promise对象
   */
  delete(url, data = {}, options = {}) {
    return this.request({
      url,
      method: 'DELETE',
      data,
      ...options
    })
  }

  /**
   * 文件上传
   * @param {string} url - 上传地址
   * @param {string} filePath - 文件路径
   * @param {string} name - 文件对应的key
   * @param {Object} formData - 其他表单数据
   * @param {Object} options - 其他选项
   * @returns {Promise} - 返回Promise对象
   */
  uploadFile(url, filePath, name = 'file', formData = {}, options = {}) {
    return new Promise((resolve, reject) => {
      // 显示上传loading
      if (options.loading !== false) {
        wx.showLoading({
          title: options.loadingText || '上传中...',
          mask: true
        })
      }
      
      // 处理上传地址
      const uploadUrl = url.startsWith('http') ? url : CONFIG.BASE_URL + url
      
      // 准备请求头
      const header = {
        'Authorization': `Bearer ${this.getToken()}`,
        ...options.header
      }
      
      wx.uploadFile({
        url: uploadUrl,
        filePath: filePath,
        name: name,
        formData: formData,
        header: header,
        success: (res) => {
          console.log('文件上传成功:', res)
          
          try {
            const data = JSON.parse(res.data)
            if (data.code === 200 || data.code === 0) {
              resolve(data.data || data)
            } else {
              reject({
                type: 'business',
                code: data.code,
                message: data.message || '上传失败'
              })
            }
          } catch (error) {
            resolve(res.data)
          }
        },
        fail: (error) => {
          console.error('文件上传失败:', error)
          reject({
            type: 'network',
            message: '文件上传失败',
            data: error
          })
        },
        complete: () => {
          if (options.loading !== false) {
            wx.hideLoading()
          }
        }
      })
    })
  }
}

// 创建请求实例
const request = new Request()

// 导出请求实例
export default request

// 导出请求方法（兼容旧版本）
export const { get, post, put, delete: del, uploadFile } = request