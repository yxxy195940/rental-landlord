// store/index.js
/**
 * MobX 状态管理
 * 
 * 使用 MobX 管理全局状态，包括：
 * 1. 用户信息和登录状态
 * 2. 房间数据
 * 3. 账单数据
 * 4. 抄表数据
 * 5. 应用配置
 */

import { observable, action, computed } from 'mobx-miniprogram'
import { formatUtils, businessUtils } from '../utils/util'

/**
 * 用户状态管理
 */
export const userStore = observable({
  // 用户信息
  userInfo: null,
  token: '',
  isLogin: false,
  房东信息: null,
  
  // 登录状态管理
  setUserInfo: action(function(userInfo) {
    this.userInfo = userInfo
    this.isLogin = !!userInfo
    
    // 同步到本地存储
    if (userInfo) {
      wx.setStorageSync('userInfo', userInfo)
    } else {
      wx.removeStorageSync('userInfo')
    }
  }),
  
  setToken: action(function(token) {
    this.token = token
    
    // 同步到本地存储
    if (token) {
      wx.setStorageSync('token', token)
    } else {
      wx.removeStorageSync('token')
    }
  }),
  
  set房东信息: action(function(房东信息) {
    this.房东信息 = 房东信息
    
    // 同步到本地存储
    if (房东信息) {
      wx.setStorageSync('房东信息', 房东信息)
    } else {
      wx.removeStorageSync('房东信息')
    }
  }),
  
  // 退出登录
  logout: action(function() {
    this.userInfo = null
    this.token = ''
    this.isLogin = false
    this.房东信息 = null
    
    // 清除本地存储
    wx.removeStorageSync('userInfo')
    wx.removeStorageSync('token')
    wx.removeStorageSync('房东信息')
    
    console.log('用户已退出登录')
  }),
  
  // 从本地存储恢复状态
  restoreFromStorage: action(function() {
    try {
      const userInfo = wx.getStorageSync('userInfo')
      const token = wx.getStorageSync('token')
      const 房东信息 = wx.getStorageSync('房东信息')
      
      if (userInfo) {
        this.userInfo = userInfo
        this.isLogin = true
      }
      
      if (token) {
        this.token = token
      }
      
      if (房东信息) {
        this.房东信息 = 房东信息
      }
      
      console.log('用户状态恢复完成', { userInfo, token: !!token, 房东信息 })
    } catch (error) {
      console.error('恢复用户状态失败:', error)
    }
  }),
  
  // 计算属性：用户显示名称
  get displayName() {
    if (this.房东信息 && this.房东信息.name) {
      return this.房东信息.name
    }
    if (this.userInfo && this.userInfo.name) {
      return this.userInfo.name
    }
    return '房东'
  }
})

/**
 * 房间状态管理
 */
export const roomStore = observable({
  // 房间数据
  roomList: [],
  currentRoom: null,
  loading: false,
  lastUpdateTime: 0,
  
  // 统计数据
  统计数据: {
    总房间数: 0,
    已租房间数: 0,
    空置房间数: 0,
    维修房间数: 0
  },
  
  // 设置房间列表
  setRoomList: action(function(roomList) {
    this.roomList = roomList
    this.lastUpdateTime = Date.now()
    this.updateStatistics()
    
    console.log('房间列表已更新', roomList.length)
  }),
  
  // 添加房间
  addRoom: action(function(room) {
    this.roomList.push(room)
    this.updateStatistics()
    console.log('房间已添加', room)
  }),
  
  // 更新房间
  updateRoom: action(function(updatedRoom) {
    const index = this.roomList.findIndex(room => room.id === updatedRoom.id)
    if (index !== -1) {
      this.roomList[index] = { ...this.roomList[index], ...updatedRoom }
      this.updateStatistics()
      console.log('房间已更新', updatedRoom)
    }
  }),
  
  // 删除房间
  removeRoom: action(function(roomId) {
    const index = this.roomList.findIndex(room => room.id === roomId)
    if (index !== -1) {
      this.roomList.splice(index, 1)
      this.updateStatistics()
      console.log('房间已删除', roomId)
    }
  }),
  
  // 设置当前房间
  setCurrentRoom: action(function(room) {
    this.currentRoom = room
  }),
  
  // 设置加载状态
  setLoading: action(function(loading) {
    this.loading = loading
  }),
  
  // 更新统计数据
  updateStatistics: action(function() {
    const 总房间数 = this.roomList.length
    const 已租房间数 = this.roomList.filter(room => room.status === 1).length
    const 空置房间数 = this.roomList.filter(room => room.status === 0).length
    const 维修房间数 = this.roomList.filter(room => room.status === 2).length
    
    this.统计数据 = {
      总房间数,
      已租房间数,
      空置房间数,
      维修房间数
    }
  }),
  
  // 根据ID获取房间
  getRoomById: function(roomId) {
    return this.roomList.find(room => room.id === roomId) || null
  },
  
  // 根据状态获取房间列表
  getRoomsByStatus: function(status) {
    return this.roomList.filter(room => room.status === status)
  },
  
  // 计算属性：空置房间列表
  get 空置房间列表() {
    return this.roomList.filter(room => room.status === 0)
  },
  
  // 计算属性：已租房间列表
  get 已租房间列表() {
    return this.roomList.filter(room => room.status === 1)
  },
  
  // 计算属性：入住率
  get 入住率() {
    if (this.统计数据.总房间数 === 0) return 0
    return Math.round((this.统计数据.已租房间数 / this.统计数据.总房间数) * 100)
  }
})

/**
 * 账单状态管理
 */
export const billStore = observable({
  // 账单数据
  billList: [],
  currentBill: null,
  loading: false,
  lastUpdateTime: 0,
  
  // 统计数据
  统计数据: {
    待收账单数: 0,
    已收账单数: 0,
    逾期账单数: 0,
    本月收租: 0,
    本年收租: 0
  },
  
  // 设置账单列表
  setBillList: action(function(billList) {
    this.billList = billList
    this.lastUpdateTime = Date.now()
    this.updateStatistics()
    
    console.log('账单列表已更新', billList.length)
  }),
  
  // 添加账单
  addBill: action(function(bill) {
    this.billList.unshift(bill)
    this.updateStatistics()
    console.log('账单已添加', bill)
  }),
  
  // 更新账单
  updateBill: action(function(updatedBill) {
    const index = this.billList.findIndex(bill => bill.id === updatedBill.id)
    if (index !== -1) {
      this.billList[index] = { ...this.billList[index], ...updatedBill }
      this.updateStatistics()
      console.log('账单已更新', updatedBill)
    }
  }),
  
  // 删除账单
  removeBill: action(function(billId) {
    const index = this.billList.findIndex(bill => bill.id === billId)
    if (index !== -1) {
      this.billList.splice(index, 1)
      this.updateStatistics()
      console.log('账单已删除', billId)
    }
  }),
  
  // 设置当前账单
  setCurrentBill: action(function(bill) {
    this.currentBill = bill
  }),
  
  // 设置加载状态
  setLoading: action(function(loading) {
    this.loading = loading
  }),
  
  // 更新统计数据
  updateStatistics: action(function() {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    
    let 待收账单数 = 0
    let 已收账单数 = 0
    let 逾期账单数 = 0
    let 本月收租 = 0
    let 本年收租 = 0
    
    this.billList.forEach(bill => {
      const billDate = new Date(bill.createdAt || bill.billDate)
      
      // 统计账单状态
      switch (bill.status) {
        case 0: // 待收
          待收账单数++
          // 检查是否逾期
          if (bill.dueDate && new Date(bill.dueDate) < now) {
            逾期账单数++
          }
          break
        case 1: // 已收
          已收账单数++
          
          // 统计收租金额
          const amount = bill.totalAmount || 0
          
          if (billDate.getFullYear() === currentYear) {
            本年收租 += amount
            
            if (billDate.getMonth() === currentMonth) {
              本月收租 += amount
            }
          }
          break
      }
    })
    
    this.统计数据 = {
      待收账单数,
      已收账单数,
      逾期账单数,
      本月收租: Number(本月收租.toFixed(2)),
      本年收租: Number(本年收租.toFixed(2))
    }
  }),
  
  // 根据房间ID获取账单列表
  getBillsByRoomId: function(roomId) {
    return this.billList.filter(bill => bill.roomId === roomId)
  },
  
  // 根据状态获取账单列表
  getBillsByStatus: function(status) {
    return this.billList.filter(bill => bill.status === status)
  },
  
  // 计算属性：待收账单列表
  get 待收账单列表() {
    return this.billList.filter(bill => bill.status === 0)
  },
  
  // 计算属性：逾期账单列表
  get 逾期账单列表() {
    const now = new Date()
    return this.billList.filter(bill => {
      return bill.status === 0 && bill.dueDate && new Date(bill.dueDate) < now
    })
  }
})

/**
 * 抄表状态管理
 */
export const meterStore = observable({
  // 抄表数据
  meterReadings: [],
  currentReading: null,
  loading: false,
  lastUpdateTime: 0,
  
  // 待抄表房间
  pendingMeterRooms: [],
  
  // 设置抄表记录列表
  setMeterReadings: action(function(readings) {
    this.meterReadings = readings
    this.lastUpdateTime = Date.now()
    
    console.log('抄表记录已更新', readings.length)
  }),
  
  // 添加抄表记录
  addMeterReading: action(function(reading) {
    this.meterReadings.unshift(reading)
    console.log('抄表记录已添加', reading)
  }),
  
  // 更新抄表记录
  updateMeterReading: action(function(updatedReading) {
    const index = this.meterReadings.findIndex(reading => reading.id === updatedReading.id)
    if (index !== -1) {
      this.meterReadings[index] = { ...this.meterReadings[index], ...updatedReading }
      console.log('抄表记录已更新', updatedReading)
    }
  }),
  
  // 设置待抄表房间
  setPendingMeterRooms: action(function(rooms) {
    this.pendingMeterRooms = rooms
  }),
  
  // 设置当前抄表记录
  setCurrentReading: action(function(reading) {
    this.currentReading = reading
  }),
  
  // 设置加载状态
  setLoading: action(function(loading) {
    this.loading = loading
  }),
  
  // 根据房间ID获取最新抄表记录
  getLatestReadingByRoomId: function(roomId) {
    const roomReadings = this.meterReadings.filter(reading => reading.roomId === roomId)
    return roomReadings.sort((a, b) => new Date(b.readingDate) - new Date(a.readingDate))[0] || null
  },
  
  // 根据房间ID获取抄表历史
  getReadingHistoryByRoomId: function(roomId) {
    return this.meterReadings
      .filter(reading => reading.roomId === roomId)
      .sort((a, b) => new Date(b.readingDate) - new Date(a.readingDate))
  },
  
  // 计算属性：待抄表房间数量
  get 待抄表数量() {
    return this.pendingMeterRooms.length
  }
})

/**
 * 应用状态管理
 */
export const appStore = observable({
  // 应用配置
  config: {
    theme: 'light',        // 主题：light/dark
    language: 'zh-CN',     // 语言
    autoRefresh: true,     // 自动刷新
    refreshInterval: 5     // 刷新间隔(分钟)
  },
  
  // 系统状态
  networkStatus: 'wifi',
  systemInfo: null,
  
  // 全局加载状态
  globalLoading: false,
  
  // 设置配置
  setConfig: action(function(config) {
    this.config = { ...this.config, ...config }
    
    // 同步到本地存储
    wx.setStorageSync('appConfig', this.config)
    
    console.log('应用配置已更新', this.config)
  }),
  
  // 设置网络状态
  setNetworkStatus: action(function(status) {
    this.networkStatus = status
  }),
  
  // 设置系统信息
  setSystemInfo: action(function(info) {
    this.systemInfo = info
  }),
  
  // 设置全局加载状态
  setGlobalLoading: action(function(loading) {
    this.globalLoading = loading
  }),
  
  // 从本地存储恢复配置
  restoreConfig: action(function() {
    try {
      const config = wx.getStorageSync('appConfig')
      if (config) {
        this.config = { ...this.config, ...config }
        console.log('应用配置恢复完成', this.config)
      }
    } catch (error) {
      console.error('恢复应用配置失败:', error)
    }
  }),
  
  // 计算属性：是否为暗黑主题
  get isDarkTheme() {
    return this.config.theme === 'dark'
  },
  
  // 计算属性：是否为WiFi网络
  get isWiFiNetwork() {
    return this.networkStatus === 'wifi'
  }
})

/**
 * 初始化所有状态
 */
export function initStores() {
  console.log('初始化状态管理')
  
  // 恢复用户状态
  userStore.restoreFromStorage()
  
  // 恢复应用配置
  appStore.restoreConfig()
  
  // 获取系统信息
  try {
    const systemInfo = wx.getSystemInfoSync()
    appStore.setSystemInfo(systemInfo)
  } catch (error) {
    console.error('获取系统信息失败:', error)
  }
  
  // 监听网络状态变化
  wx.onNetworkStatusChange((res) => {
    appStore.setNetworkStatus(res.networkType)
  })
  
  console.log('状态管理初始化完成')
}

/**
 * 清除所有状态（用于退出登录）
 */
export function clearStores() {
  console.log('清除状态管理')
  
  // 清除用户状态
  userStore.logout()
  
  // 清除业务数据
  roomStore.setRoomList([])
  billStore.setBillList([])
  meterStore.setMeterReadings([])
  
  console.log('状态管理清除完成')
}

// 导出所有store
export default {
  userStore,
  roomStore,
  billStore,
  meterStore,
  appStore,
  initStores,
  clearStores
}