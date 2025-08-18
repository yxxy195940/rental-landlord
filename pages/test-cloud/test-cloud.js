// pages/test-cloud/test-cloud.js
/**
 * 云函数测试页面
 * 用于测试各种云函数调用功能
 */

Page({
  data: {
    testResults: [],
    loading: false
  },

  onLoad() {
    console.log('云函数测试页面加载')
  },

  /**
   * 添加测试结果
   */
  addTestResult(title, result, success = true) {
    const results = this.data.testResults
    results.unshift({
      id: Date.now(),
      title,
      result: JSON.stringify(result, null, 2),
      success,
      time: new Date().toLocaleTimeString()
    })
    
    this.setData({
      testResults: results
    })
  },

  /**
   * 清空测试结果
   */
  clearResults() {
    this.setData({
      testResults: []
    })
  },

  /**
   * 测试1：获取房间列表
   */
  async testGetRoomList() {
    this.setData({ loading: true })
    
    try {
      console.log('开始测试获取房间列表...')
      
      const res = await wx.cloud.callFunction({
        name: 'room',
        data: {
          action: 'list',
          page: 1,
          pageSize: 10
        }
      })
      
      console.log('获取房间列表成功:', res)
      this.addTestResult('获取房间列表', res.result, true)
      
      wx.showToast({
        title: '测试成功',
        icon: 'success'
      })
      
    } catch (error) {
      console.error('获取房间列表失败:', error)
      this.addTestResult('获取房间列表', error, false)
      
      wx.showToast({
        title: '测试失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 测试2：添加测试房间
   */
  async testAddRoom() {
    this.setData({ loading: true })
    
    try {
      console.log('开始测试添加房间...')
      
      const testRoom = {
        roomNumber: `测试房间${Date.now()}`,
        address: '测试地址123号',
        rent: 1500,
        deposit: 1500,
        area: 25,
        isRented: false,
        createTime: new Date().toISOString()
      }
      
      const res = await wx.cloud.callFunction({
        name: 'room',
        data: {
          action: 'add',
          roomData: testRoom
        }
      })
      
      console.log('添加房间成功:', res)
      this.addTestResult('添加测试房间', res.result, true)
      
      wx.showToast({
        title: '添加成功',
        icon: 'success'
      })
      
    } catch (error) {
      console.error('添加房间失败:', error)
      this.addTestResult('添加测试房间', error, false)
      
      wx.showToast({
        title: '添加失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 测试3：测试云函数错误处理
   */
  async testErrorHandling() {
    this.setData({ loading: true })
    
    try {
      console.log('开始测试错误处理...')
      
      const res = await wx.cloud.callFunction({
        name: 'room',
        data: {
          action: 'invalid_action', // 故意传入无效的 action
        }
      })
      
      console.log('错误处理测试结果:', res)
      this.addTestResult('错误处理测试', res.result, false)
      
    } catch (error) {
      console.error('错误处理测试:', error)
      this.addTestResult('错误处理测试', error, false)
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 测试4：测试数据库直接操作
   */
  async testDatabase() {
    this.setData({ loading: true })
    
    try {
      console.log('开始测试数据库操作...')
      
      // 直接查询数据库
      const db = wx.cloud.database()
      const res = await db.collection('rooms').limit(5).get()
      
      console.log('数据库查询成功:', res)
      this.addTestResult('数据库直接查询', res, true)
      
      wx.showToast({
        title: '查询成功',
        icon: 'success'
      })
      
    } catch (error) {
      console.error('数据库查询失败:', error)
      this.addTestResult('数据库直接查询', error, false)
      
      wx.showToast({
        title: '查询失败',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 测试5：测试用户身份获取
   */
  async testUserContext() {
    this.setData({ loading: true })
    
    try {
      console.log('开始测试用户身份...')
      
      const res = await wx.cloud.callFunction({
        name: 'room',
        data: {
          action: 'getUserInfo' // 需要在云函数中添加这个action
        }
      })
      
      console.log('用户身份测试结果:', res)
      this.addTestResult('用户身份测试', res.result, true)
      
    } catch (error) {
      console.error('用户身份测试失败:', error)
      this.addTestResult('用户身份测试', error, false)
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 运行所有测试
   */
  async runAllTests() {
    wx.showLoading({
      title: '运行测试中...',
      mask: true
    })
    
    // 清空之前的结果
    this.clearResults()
    
    // 依次运行所有测试
    await this.testDatabase()
    await new Promise(resolve => setTimeout(resolve, 1000)) // 等待1秒
    
    await this.testGetRoomList()
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    await this.testAddRoom()
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    await this.testErrorHandling()
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    await this.testUserContext()
    
    wx.hideLoading()
    wx.showToast({
      title: '所有测试完成',
      icon: 'success'
    })
  },

  /**
   * 复制测试结果
   */
  copyResult(event) {
    const index = event.currentTarget.dataset.index
    const result = this.data.testResults[index]
    
    wx.setClipboardData({
      data: `${result.title}\n时间: ${result.time}\n结果: ${result.result}`,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success'
        })
      }
    })
  }
})