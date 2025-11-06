// utils/util.js
/**
 * 通用工具类
 * 
 * 提供项目中常用的工具函数，包括：
 * 1. 日期时间处理
 * 2. 数据格式化
 * 3. 数据验证
 * 4. 字符串处理
 * 5. 数组对象操作
 * 6. 业务相关工具
 */

/**
 * 日期时间工具
 */
export const dateUtils = {
  /**
   * 格式化日期
   * @param {Date|string|number} date - 日期
   * @param {string} format - 格式化模板
   * @returns {string} - 格式化后的日期字符串
   */
  format(date, format = 'YYYY-MM-DD') {
    if (!date) return ''
    
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    
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
   * 获取相对时间描述
   * @param {Date|string|number} date - 日期
   * @returns {string} - 相对时间描述
   */
  getRelativeTime(date) {
    if (!date) return ''
    
    const now = new Date()
    const targetDate = new Date(date)
    const diff = now.getTime() - targetDate.getTime()
    
    if (diff < 0) return '未来'
    
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour
    const week = 7 * day
    const month = 30 * day
    
    if (diff < minute) return '刚刚'
    if (diff < hour) return `${Math.floor(diff / minute)}分钟前`
    if (diff < day) return `${Math.floor(diff / hour)}小时前`
    if (diff < week) return `${Math.floor(diff / day)}天前`
    if (diff < month) return `${Math.floor(diff / week)}周前`
    
    return this.format(date, 'YYYY-MM-DD')
  },

  /**
   * 获取月份天数
   * @param {number} year - 年份
   * @param {number} month - 月份(1-12)
   * @returns {number} - 天数
   */
  getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate()
  },

  /**
   * 判断是否为今天
   * @param {Date|string|number} date - 日期
   * @returns {boolean} - 是否为今天
   */
  isToday(date) {
    if (!date) return false
    
    const today = new Date()
    const targetDate = new Date(date)
    
    return today.getFullYear() === targetDate.getFullYear() &&
           today.getMonth() === targetDate.getMonth() &&
           today.getDate() === targetDate.getDate()
  },

  /**
   * 判断是否为本月
   * @param {Date|string|number} date - 日期
   * @returns {boolean} - 是否为本月
   */
  isThisMonth(date) {
    if (!date) return false
    
    const today = new Date()
    const targetDate = new Date(date)
    
    return today.getFullYear() === targetDate.getFullYear() &&
           today.getMonth() === targetDate.getMonth()
  }
}

/**
 * 格式化工具
 */
export const formatUtils = {
  /**
   * 格式化金额
   * @param {number|string} amount - 金额
   * @param {number} decimals - 小数位数
   * @param {boolean} showSymbol - 是否显示货币符号
   * @returns {string} - 格式化后的金额
   */
  formatMoney(amount, decimals = 2, showSymbol = true) {
    if (amount === null || amount === undefined || amount === '') return '0.00'
    
    const num = Number(amount)
    if (isNaN(num)) return '0.00'
    
    const formatted = num.toFixed(decimals)
    return showSymbol ? `¥${formatted}` : formatted
  },

  /**
   * 格式化手机号
   * @param {string} phone - 手机号
   * @returns {string} - 格式化后的手机号
   */
  formatPhone(phone) {
    if (!phone) return ''
    
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length !== 11) return phone
    
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`
  },

  /**
   * 格式化房间号
   * @param {string} roomNumber - 房间号
   * @returns {string} - 格式化后的房间号
   */
  formatRoomNumber(roomNumber) {
    if (!roomNumber) return ''
    
    // 如果是纯数字，添加"号"后缀
    if (/^\d+$/.test(roomNumber)) {
      return `${roomNumber}号`
    }
    
    return roomNumber
  },

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} - 格式化后的文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  },

  /**
   * 格式化数字，添加千分位分隔符
   * @param {number|string} number - 数字
   * @returns {string} - 格式化后的数字
   */
  formatNumber(number) {
    if (number === null || number === undefined) return '0'
    
    return Number(number).toLocaleString()
  }
}

/**
 * 验证工具
 */
export const validateUtils = {
  /**
   * 验证手机号
   * @param {string} phone - 手机号
   * @returns {boolean} - 是否有效
   */
  isValidPhone(phone) {
    if (!phone) return false
    
    const phoneRegex = /^1[3-9]\d{9}$/
    return phoneRegex.test(phone)
  },

  /**
   * 验证邮箱
   * @param {string} email - 邮箱
   * @returns {boolean} - 是否有效
   */
  isValidEmail(email) {
    if (!email) return false
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  /**
   * 验证身份证号
   * @param {string} idCard - 身份证号
   * @returns {boolean} - 是否有效
   */
  isValidIdCard(idCard) {
    if (!idCard) return false
    
    const idCardRegex = /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/
    return idCardRegex.test(idCard)
  },

  /**
   * 验证密码强度
   * @param {string} password - 密码
   * @returns {Object} - 验证结果
   */
  validatePassword(password) {
    if (!password) {
      return { valid: false, message: '密码不能为空' }
    }
    
    if (password.length < 6) {
      return { valid: false, message: '密码至少6位' }
    }
    
    if (password.length > 20) {
      return { valid: false, message: '密码最多20位' }
    }
    
    // 检查是否包含数字和字母
    const hasNumber = /\d/.test(password)
    const hasLetter = /[a-zA-Z]/.test(password)
    
    if (!hasNumber || !hasLetter) {
      return { valid: false, message: '密码必须包含数字和字母' }
    }
    
    return { valid: true, message: '密码强度良好' }
  },

  /**
   * 验证金额
   * @param {string|number} amount - 金额
   * @returns {boolean} - 是否有效
   */
  isValidAmount(amount) {
    if (amount === null || amount === undefined || amount === '') return false
    
    const num = Number(amount)
    return !isNaN(num) && num >= 0 && num <= 999999.99
  },

  /**
   * 验证房间号
   * @param {string} roomNumber - 房间号
   * @returns {boolean} - 是否有效
   */
  isValidRoomNumber(roomNumber) {
    if (!roomNumber) return false
    
    const cleaned = roomNumber.trim()
    return cleaned.length > 0 && cleaned.length <= 10
  }
}

/**
 * 字符串工具
 */
export const stringUtils = {
  /**
   * 去除字符串空格
   * @param {string} str - 字符串
   * @param {string} type - 类型：all-全部，left-左边，right-右边，both-两边
   * @returns {string} - 处理后的字符串
   */
  trim(str, type = 'both') {
    if (!str) return ''
    
    switch (type) {
      case 'all':
        return str.replace(/\s/g, '')
      case 'left':
        return str.replace(/^\s+/, '')
      case 'right':
        return str.replace(/\s+$/, '')
      case 'both':
      default:
        return str.trim()
    }
  },

  /**
   * 截取字符串
   * @param {string} str - 字符串
   * @param {number} length - 长度
   * @param {string} suffix - 后缀
   * @returns {string} - 截取后的字符串
   */
  truncate(str, length, suffix = '...') {
    if (!str) return ''
    
    if (str.length <= length) return str
    
    return str.substring(0, length) + suffix
  },

  /**
   * 首字母大写
   * @param {string} str - 字符串
   * @returns {string} - 首字母大写的字符串
   */
  capitalize(str) {
    if (!str) return ''
    
    return str.charAt(0).toUpperCase() + str.slice(1)
  },

  /**
   * 生成随机字符串
   * @param {number} length - 长度
   * @param {string} chars - 字符集
   * @returns {string} - 随机字符串
   */
  random(length = 8, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  },

  /**
   * 隐藏手机号中间四位
   * @param {string} phone - 手机号
   * @returns {string} - 隐藏后的手机号
   */
  hidePhone(phone) {
    if (!phone) return ''
    
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length !== 11) return phone
    
    return `${cleaned.slice(0, 3)}****${cleaned.slice(7)}`
  },

  /**
   * 隐藏身份证号
   * @param {string} idCard - 身份证号
   * @returns {string} - 隐藏后的身份证号
   */
  hideIdCard(idCard) {
    if (!idCard) return ''
    
    if (idCard.length < 8) return idCard
    
    return `${idCard.slice(0, 4)}**********${idCard.slice(-4)}`
  }
}

/**
 * 数组对象工具
 */
export const arrayUtils = {
  /**
   * 数组去重
   * @param {Array} arr - 数组
   * @param {string} key - 去重字段（对象数组）
   * @returns {Array} - 去重后的数组
   */
  unique(arr, key) {
    if (!Array.isArray(arr)) return []
    
    if (key) {
      const seen = new Set()
      return arr.filter(item => {
        const value = item[key]
        if (seen.has(value)) return false
        seen.add(value)
        return true
      })
    } else {
      return [...new Set(arr)]
    }
  },

  /**
   * 数组排序
   * @param {Array} arr - 数组
   * @param {string} key - 排序字段
   * @param {string} order - 排序方式：asc-升序，desc-降序
   * @returns {Array} - 排序后的数组
   */
  sort(arr, key, order = 'asc') {
    if (!Array.isArray(arr)) return []
    
    return arr.sort((a, b) => {
      let aValue = key ? a[key] : a
      let bValue = key ? b[key] : b
      
      // 处理数字类型
      if (typeof aValue === 'string' && !isNaN(aValue)) aValue = Number(aValue)
      if (typeof bValue === 'string' && !isNaN(bValue)) bValue = Number(bValue)
      
      if (order === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })
  },

  /**
   * 数组分组
   * @param {Array} arr - 数组
   * @param {string} key - 分组字段
   * @returns {Object} - 分组后的对象
   */
  groupBy(arr, key) {
    if (!Array.isArray(arr)) return {}
    
    return arr.reduce((result, item) => {
      const group = item[key]
      if (!result[group]) {
        result[group] = []
      }
      result[group].push(item)
      return result
    }, {})
  },

  /**
   * 数组分页
   * @param {Array} arr - 数组
   * @param {number} page - 页码
   * @param {number} pageSize - 每页大小
   * @returns {Object} - 分页结果
   */
  paginate(arr, page, pageSize) {
    if (!Array.isArray(arr)) return { data: [], total: 0, page: 1, pageSize: 10 }
    
    const start = (page - 1) * pageSize
    const end = start + pageSize
    
    return {
      data: arr.slice(start, end),
      total: arr.length,
      page: page,
      pageSize: pageSize,
      totalPages: Math.ceil(arr.length / pageSize)
    }
  }
}

/**
 * 业务工具
 */
export const businessUtils = {
  /**
   * 获取房间状态文本
   * @param {number} status - 状态值
   * @returns {string} - 状态文本
   */
  getRoomStatusText(status) {
    const statusMap = {
      0: '空置',
      1: '已租',
      2: '维修',
      3: '停租'
    }
    return statusMap[status] || '未知'
  },

  /**
   * 获取房间状态标签类型
   * @param {number} status - 状态值
   * @returns {string} - 标签类型
   */
  getRoomStatusTagType(status) {
    const typeMap = {
      0: 'info',      // 空置 - 蓝色
      1: 'success',   // 已租 - 绿色
      2: 'warning',   // 维修 - 橙色
      3: 'error'      // 停租 - 红色
    }
    return typeMap[status] || 'info'
  },

  /**
   * 获取账单状态文本
   * @param {number} status - 状态值
   * @returns {string} - 状态文本
   */
  getBillStatusText(status) {
    const statusMap = {
      0: '待收',
      1: '已收',
      2: '逾期',
      3: '部分收款'
    }
    return statusMap[status] || '未知'
  },

  /**
   * 获取账单状态标签类型
   * @param {number} status - 状态值
   * @returns {string} - 标签类型
   */
  getBillStatusTagType(status) {
    const typeMap = {
      0: 'warning',   // 待收 - 橙色
      1: 'success',   // 已收 - 绿色
      2: 'error',     // 逾期 - 红色
      3: 'info'       // 部分收款 - 蓝色
    }
    return typeMap[status] || 'info'
  },

  /**
   * 计算租金
   * @param {number} dailyRent - 日租金
   * @param {number} days - 天数
   * @returns {number} - 总租金
   */
  calculateRent(dailyRent, days) {
    if (!dailyRent || !days) return 0
    
    return Number((dailyRent * days).toFixed(2))
  },

  /**
   * 计算水电费
   * @param {number} currentReading - 当前读数
   * @param {number} lastReading - 上次读数
   * @param {number} unitPrice - 单价
   * @returns {number} - 费用
   */
  calculateUtilityFee(currentReading, lastReading, unitPrice) {
    if (!currentReading || !lastReading || !unitPrice) return 0
    
    const usage = currentReading - lastReading
    if (usage < 0) return 0
    
    return Number((usage * unitPrice).toFixed(2))
  },

  /**
   * 生成账单编号
   * @param {string} prefix - 前缀
   * @returns {string} - 账单编号
   */
  generateBillNumber(prefix = 'B') {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    
    return `${prefix}${year}${month}${day}${hour}${minute}${second}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
  }
}

/**
 * 系统工具
 */
export const systemUtils = {
  /**
   * 获取系统信息
   * @returns {Object} - 系统信息
   */
  getSystemInfo() {
    try {
      return wx.getSystemInfoSync()
    } catch (error) {
      console.error('获取系统信息失败:', error)
      return {}
    }
  },

  /**
   * 检查网络状态
   * @returns {Promise<string>} - 网络状态
   */
  checkNetworkStatus() {
    return new Promise((resolve) => {
      wx.getNetworkType({
        success: (res) => {
          resolve(res.networkType)
        },
        fail: () => {
          resolve('none')
        }
      })
    })
  },

  /**
   * 复制到剪贴板
   * @param {string} text - 要复制的文本
   * @returns {Promise<boolean>} - 是否成功
   */
  copyToClipboard(text) {
    return new Promise((resolve) => {
      wx.setClipboardData({
        data: text,
        success: () => {
          wx.showToast({
            title: '复制成功',
            icon: 'success',
            duration: 1000
          })
          resolve(true)
        },
        fail: () => {
          wx.showToast({
            title: '复制失败',
            icon: 'none',
            duration: 1000
          })
          resolve(false)
        }
      })
    })
  },

  /**
   * 拨打电话
   * @param {string} phoneNumber - 电话号码
   */
  makePhoneCall(phoneNumber) {
    if (!phoneNumber) return
    
    wx.makePhoneCall({
      phoneNumber: phoneNumber,
      fail: () => {
        wx.showToast({
          title: '拨打失败',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 预览图片
   * @param {string} current - 当前图片
   * @param {Array} urls - 图片数组
   */
  previewImage(current, urls = []) {
    if (!current) return
    
    const imageUrls = Array.isArray(urls) && urls.length > 0 ? urls : [current]
    
    wx.previewImage({
      current: current,
      urls: imageUrls,
      fail: () => {
        wx.showToast({
          title: '预览失败',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 保存图片到相册
   * @param {string} filePath - 图片路径
   * @returns {Promise<boolean>} - 是否成功
   */
  saveImageToPhotosAlbum(filePath) {
    return new Promise((resolve) => {
      wx.saveImageToPhotosAlbum({
        filePath: filePath,
        success: () => {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          })
          resolve(true)
        },
        fail: () => {
          wx.showToast({
            title: '保存失败',
            icon: 'none'
          })
          resolve(false)
        }
      })
    })
  }
}

// 导出所有工具
export default {
  dateUtils,
  formatUtils,
  validateUtils,
  stringUtils,
  arrayUtils,
  businessUtils,
  systemUtils
}