// utils/storage.js
/**
 * 本地存储工具类
 * 
 * 封装了微信小程序的本地存储功能，包括：
 * 1. 统一的存储接口
 * 2. 数据类型转换
 * 3. 过期时间管理
 * 4. 错误处理
 * 5. 存储空间管理
 */

/**
 * 本地存储类
 */
class Storage {
  constructor() {
    this.prefix = 'rental_'  // 存储键前缀，避免命名冲突
  }

  /**
   * 生成存储键
   * @param {string} key - 原始键名
   * @returns {string} - 带前缀的键名
   */
  getStorageKey(key) {
    return this.prefix + key
  }

  /**
   * 设置存储数据
   * @param {string} key - 键名
   * @param {*} value - 值
   * @param {number} expire - 过期时间(分钟)，0表示永不过期
   * @returns {boolean} - 是否设置成功
   */
  set(key, value, expire = 0) {
    try {
      const storageKey = this.getStorageKey(key)
      
      // 构造存储对象
      const storageData = {
        value: value,
        timestamp: Date.now(),
        expire: expire > 0 ? Date.now() + expire * 60 * 1000 : 0
      }
      
      // 同步存储
      wx.setStorageSync(storageKey, storageData)
      
      console.log(`存储数据成功: ${key}`, storageData)
      return true
    } catch (error) {
      console.error(`存储数据失败: ${key}`, error)
      return false
    }
  }

  /**
   * 异步设置存储数据
   * @param {string} key - 键名
   * @param {*} value - 值
   * @param {number} expire - 过期时间(分钟)
   * @returns {Promise<boolean>} - 是否设置成功
   */
  setAsync(key, value, expire = 0) {
    return new Promise((resolve) => {
      try {
        const storageKey = this.getStorageKey(key)
        
        const storageData = {
          value: value,
          timestamp: Date.now(),
          expire: expire > 0 ? Date.now() + expire * 60 * 1000 : 0
        }
        
        wx.setStorage({
          key: storageKey,
          data: storageData,
          success: () => {
            console.log(`异步存储数据成功: ${key}`, storageData)
            resolve(true)
          },
          fail: (error) => {
            console.error(`异步存储数据失败: ${key}`, error)
            resolve(false)
          }
        })
      } catch (error) {
        console.error(`异步存储数据失败: ${key}`, error)
        resolve(false)
      }
    })
  }

  /**
   * 获取存储数据
   * @param {string} key - 键名
   * @param {*} defaultValue - 默认值
   * @returns {*} - 存储的值或默认值
   */
  get(key, defaultValue = null) {
    try {
      const storageKey = this.getStorageKey(key)
      const storageData = wx.getStorageSync(storageKey)
      
      if (!storageData) {
        console.log(`获取存储数据为空: ${key}`)
        return defaultValue
      }
      
      // 检查数据格式
      if (typeof storageData !== 'object' || storageData.value === undefined) {
        console.log(`存储数据格式错误: ${key}`, storageData)
        return defaultValue
      }
      
      // 检查是否过期
      if (storageData.expire > 0 && Date.now() > storageData.expire) {
        console.log(`存储数据已过期: ${key}`)
        this.remove(key)
        return defaultValue
      }
      
      console.log(`获取存储数据成功: ${key}`, storageData.value)
      return storageData.value
    } catch (error) {
      console.error(`获取存储数据失败: ${key}`, error)
      return defaultValue
    }
  }

  /**
   * 异步获取存储数据
   * @param {string} key - 键名
   * @param {*} defaultValue - 默认值
   * @returns {Promise<*>} - 存储的值或默认值
   */
  getAsync(key, defaultValue = null) {
    return new Promise((resolve) => {
      try {
        const storageKey = this.getStorageKey(key)
        
        wx.getStorage({
          key: storageKey,
          success: (res) => {
            const storageData = res.data
            
            if (!storageData || typeof storageData !== 'object' || storageData.value === undefined) {
              console.log(`异步获取存储数据格式错误: ${key}`, storageData)
              resolve(defaultValue)
              return
            }
            
            // 检查是否过期
            if (storageData.expire > 0 && Date.now() > storageData.expire) {
              console.log(`异步获取存储数据已过期: ${key}`)
              this.remove(key)
              resolve(defaultValue)
              return
            }
            
            console.log(`异步获取存储数据成功: ${key}`, storageData.value)
            resolve(storageData.value)
          },
          fail: (error) => {
            console.error(`异步获取存储数据失败: ${key}`, error)
            resolve(defaultValue)
          }
        })
      } catch (error) {
        console.error(`异步获取存储数据失败: ${key}`, error)
        resolve(defaultValue)
      }
    })
  }

  /**
   * 删除存储数据
   * @param {string} key - 键名
   * @returns {boolean} - 是否删除成功
   */
  remove(key) {
    try {
      const storageKey = this.getStorageKey(key)
      wx.removeStorageSync(storageKey)
      console.log(`删除存储数据成功: ${key}`)
      return true
    } catch (error) {
      console.error(`删除存储数据失败: ${key}`, error)
      return false
    }
  }

  /**
   * 异步删除存储数据
   * @param {string} key - 键名
   * @returns {Promise<boolean>} - 是否删除成功
   */
  removeAsync(key) {
    return new Promise((resolve) => {
      try {
        const storageKey = this.getStorageKey(key)
        
        wx.removeStorage({
          key: storageKey,
          success: () => {
            console.log(`异步删除存储数据成功: ${key}`)
            resolve(true)
          },
          fail: (error) => {
            console.error(`异步删除存储数据失败: ${key}`, error)
            resolve(false)
          }
        })
      } catch (error) {
        console.error(`异步删除存储数据失败: ${key}`, error)
        resolve(false)
      }
    })
  }

  /**
   * 检查键是否存在
   * @param {string} key - 键名
   * @returns {boolean} - 是否存在
   */
  has(key) {
    try {
      const storageKey = this.getStorageKey(key)
      const storageData = wx.getStorageSync(storageKey)
      
      if (!storageData) {
        return false
      }
      
      // 检查是否过期
      if (storageData.expire > 0 && Date.now() > storageData.expire) {
        this.remove(key)
        return false
      }
      
      return true
    } catch (error) {
      console.error(`检查存储键失败: ${key}`, error)
      return false
    }
  }

  /**
   * 获取所有键名
   * @returns {Array<string>} - 所有键名（不包含前缀）
   */
  getAllKeys() {
    try {
      const info = wx.getStorageInfoSync()
      const keys = info.keys || []
      
      // 过滤出本应用的键名并去掉前缀
      return keys
        .filter(key => key.startsWith(this.prefix))
        .map(key => key.replace(this.prefix, ''))
    } catch (error) {
      console.error('获取所有存储键失败:', error)
      return []
    }
  }

  /**
   * 获取存储信息
   * @returns {Object} - 存储信息
   */
  getInfo() {
    try {
      const info = wx.getStorageInfoSync()
      return {
        keys: info.keys || [],
        currentSize: info.currentSize || 0,
        limitSize: info.limitSize || 0
      }
    } catch (error) {
      console.error('获取存储信息失败:', error)
      return {
        keys: [],
        currentSize: 0,
        limitSize: 0
      }
    }
  }

  /**
   * 清除所有存储数据
   * @returns {boolean} - 是否清除成功
   */
  clear() {
    try {
      // 获取所有键名
      const keys = this.getAllKeys()
      
      // 逐个删除本应用的数据
      keys.forEach(key => {
        this.remove(key)
      })
      
      console.log('清除所有存储数据成功')
      return true
    } catch (error) {
      console.error('清除所有存储数据失败:', error)
      return false
    }
  }

  /**
   * 清除过期数据
   * @returns {number} - 清除的数据数量
   */
  clearExpired() {
    try {
      const keys = this.getAllKeys()
      let clearCount = 0
      
      keys.forEach(key => {
        const storageKey = this.getStorageKey(key)
        const storageData = wx.getStorageSync(storageKey)
        
        if (storageData && storageData.expire > 0 && Date.now() > storageData.expire) {
          this.remove(key)
          clearCount++
        }
      })
      
      console.log(`清除过期数据成功，共清除 ${clearCount} 条`)
      return clearCount
    } catch (error) {
      console.error('清除过期数据失败:', error)
      return 0
    }
  }

  /**
   * 获取存储大小(字节)
   * @param {string} key - 键名，不传则返回总大小
   * @returns {number} - 存储大小
   */
  getSize(key) {
    try {
      if (key) {
        const storageKey = this.getStorageKey(key)
        const storageData = wx.getStorageSync(storageKey)
        return storageData ? JSON.stringify(storageData).length : 0
      } else {
        // 计算总大小
        const keys = this.getAllKeys()
        let totalSize = 0
        
        keys.forEach(k => {
          totalSize += this.getSize(k)
        })
        
        return totalSize
      }
    } catch (error) {
      console.error('获取存储大小失败:', error)
      return 0
    }
  }

  /**
   * 批量设置数据
   * @param {Object} data - 数据对象
   * @param {number} expire - 过期时间(分钟)
   * @returns {boolean} - 是否设置成功
   */
  setBatch(data, expire = 0) {
    try {
      let success = true
      
      for (const [key, value] of Object.entries(data)) {
        const result = this.set(key, value, expire)
        if (!result) {
          success = false
        }
      }
      
      return success
    } catch (error) {
      console.error('批量设置数据失败:', error)
      return false
    }
  }

  /**
   * 批量获取数据
   * @param {Array<string>} keys - 键名数组
   * @param {*} defaultValue - 默认值
   * @returns {Object} - 数据对象
   */
  getBatch(keys, defaultValue = null) {
    try {
      const result = {}
      
      keys.forEach(key => {
        result[key] = this.get(key, defaultValue)
      })
      
      return result
    } catch (error) {
      console.error('批量获取数据失败:', error)
      return {}
    }
  }

  /**
   * 批量删除数据
   * @param {Array<string>} keys - 键名数组
   * @returns {boolean} - 是否删除成功
   */
  removeBatch(keys) {
    try {
      let success = true
      
      keys.forEach(key => {
        const result = this.remove(key)
        if (!result) {
          success = false
        }
      })
      
      return success
    } catch (error) {
      console.error('批量删除数据失败:', error)
      return false
    }
  }
}

// 创建存储实例
const storage = new Storage()

// 导出存储实例
export default storage

// 导出常用方法（兼容旧版本）
export const { set, get, remove, has, clear } = storage