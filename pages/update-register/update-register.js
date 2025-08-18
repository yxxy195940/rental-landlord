// pages/update-register/update-register.js
import request from '../../utils/request'

Page({
  data: {
    loading: false,
    submitting: false,
    roomId: '',
    roomInfo: null,
    
    // 租客信息
    tenantName: '',
    tenantPhone: '',
    
    // 水电表信息
    currentWaterReading: '',
    currentElectricityReading: '',
    meterDate: '',
    
    // 表单验证错误
    errors: {}
  },

  onLoad(options) {
    if (options.roomId) {
      this.setData({ roomId: options.roomId })
      this.initDefaultValues()
      this.loadRoomInfo()
    } else {
      wx.showToast({
        title: '房间ID不能为空',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  /**
   * 初始化默认值
   */
  initDefaultValues() {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    
    this.setData({
      meterDate: today
    })
  },

  /**
   * 加载房间信息
   */
  async loadRoomInfo() {
    try {
      this.setData({ loading: true })
      
      const res = await request.request({
        cloudFunc: 'room',
        data: {
          action: 'detail',
          roomId: this.data.roomId
        }
      })
      
      if (res) {
        this.setData({
          roomInfo: res,
          tenantName: res.tenantName || '',
          tenantPhone: res.tenantPhone || '',
          currentWaterReading: res.lastWaterReading ? res.lastWaterReading.toString() : '',
          currentElectricityReading: res.lastElectricityReading ? res.lastElectricityReading.toString() : ''
        })
        
        wx.setNavigationBarTitle({
          title: `${res.roomNumber}室 - 更新登记信息`
        })
      }
    } catch (error) {
      console.error('加载房间信息失败:', error)
      wx.showToast({
        title: '加载房间信息失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 输入框变化处理
   */
  onInputChange(e) {
    const { field } = e.currentTarget.dataset
    const value = e.detail.value
    
    this.setData({
      [field]: value,
      [`errors.${field}`]: ''
    })
  },

  /**
   * 日期选择
   */
  onDateChange(e) {
    const { field } = e.currentTarget.dataset
    const value = e.detail.value
    
    this.setData({
      [field]: value,
      [`errors.${field}`]: ''
    })
  },

  /**
   * 表单验证
   */
  validateForm() {
    const errors = {}
    const { tenantPhone, currentWaterReading, currentElectricityReading, meterDate } = this.data
    
    // 手机号验证（可选，但如果填写需要格式正确）
    if (tenantPhone && !/^1[3-9]\d{9}$/.test(tenantPhone)) {
      errors.tenantPhone = '请输入正确的手机号格式'
    }
    
    // 水电表读数验证（可选，但如果填写需要是有效数字）
    if (currentWaterReading && (isNaN(currentWaterReading) || parseFloat(currentWaterReading) < 0)) {
      errors.currentWaterReading = '请输入有效的水表读数'
    }
    
    if (currentElectricityReading && (isNaN(currentElectricityReading) || parseFloat(currentElectricityReading) < 0)) {
      errors.currentElectricityReading = '请输入有效的电表读数'
    }
    
    // 如果填写了表读数，需要填写日期
    const hasReading = currentWaterReading || currentElectricityReading
    if (hasReading && !meterDate) {
      errors.meterDate = '填写表读数时请选择记录日期'
    }
    
    this.setData({ errors })
    return Object.keys(errors).length === 0
  },

  /**
   * 确认更新
   */
  async confirmUpdate() {
    if (!this.validateForm()) {
      wx.showToast({
        title: '请检查表单信息',
        icon: 'none'
      })
      return
    }
    
    this.setData({ submitting: true })
    
    try {
      const {
        roomId,
        tenantName,
        tenantPhone,
        currentWaterReading,
        currentElectricityReading,
        meterDate
      } = this.data
      
      const requestData = {
        action: 'updateRegisterInfo',
        roomId: roomId,
        tenantName: tenantName.trim() || null,
        tenantPhone: tenantPhone.trim() || null,
        lastWaterReading: (currentWaterReading && !isNaN(parseFloat(currentWaterReading))) ? parseFloat(currentWaterReading) : null,
        lastElectricityReading: (currentElectricityReading && !isNaN(parseFloat(currentElectricityReading))) ? parseFloat(currentElectricityReading) : null,
        meterDate: meterDate || null
      }
      
      console.log('发送到云函数的数据:', requestData)
      
      // 调用更新云函数
      const res = await request.request({
        cloudFunc: 'room',
        data: requestData
      })
      
      console.log('云函数返回结果:', res)
      
      if (res && res.code === 200) {
        wx.showToast({
          title: '更新成功',
          icon: 'success'
        })
        
        // 返回上一页并刷新
        setTimeout(() => {
          wx.navigateBack({
            success: () => {
              // 通知前一个页面刷新数据
              const pages = getCurrentPages()
              if (pages.length > 1) {
                const prevPage = pages[pages.length - 2]
                if (prevPage.loadRoomDetail) {
                  prevPage.loadRoomDetail(roomId)
                }
              }
            }
          })
        }, 1500)
        
      } else {
        throw new Error(res.message || '更新失败')
      }
      
    } catch (error) {
      console.error('更新失败:', error)
      console.error('错误详情:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      })
      
      let errorMessage = '更新失败'
      if (error.message) {
        errorMessage = error.message
      } else if (error.errMsg) {
        errorMessage = error.errMsg
      }
      
      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 3000
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  /**
   * 取消操作
   */
  cancel() {
    wx.showModal({
      title: '确认取消',
      content: '确定要取消更新吗？未保存的信息将丢失。',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack()
        }
      }
    })
  }
})