// pages/checkout-register/checkout-register.js
import request from '../../utils/request'

Page({
  data: {
    loading: false,
    submitting: false,
    roomId: '',
    roomInfo: null,
    
    // 退租信息
    checkoutDate: '',
    checkoutReason: '',
    reasonOptions: [
      '到期搬离',
      '提前退租',
      '工作调动',
      '其他原因'
    ],
    reasonIndex: 0,
    remark: '',
    
    // 水电表信息
    finalWaterReading: '',
    finalElectricityReading: '',
    meterDate: '',
    
    // 费用结算
    depositRefund: '',
    finalBillAmount: '',
    actualRefund: '',
    
    // 表单验证
    errors: {}
  },

  onLoad(options) {
    if (options.roomId) {
      this.setData({ roomId: options.roomId })
      this.loadRoomInfo()
      this.initDefaultValues()
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
          finalWaterReading: res.lastWaterReading || '',
          finalElectricityReading: res.lastElectricityReading || '',
          depositRefund: res.deposit || ''
        })
        
        wx.setNavigationBarTitle({
          title: `${res.roomNumber}室 - 退租登记`
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
   * 初始化默认值
   */
  initDefaultValues() {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    
    this.setData({
      checkoutDate: today,
      meterDate: today,
      checkoutReason: this.data.reasonOptions[0]
    })
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
    
    // 如果是押金或最终账单金额变化，自动计算实际退款
    if (field === 'depositRefund' || field === 'finalBillAmount') {
      this.calculateActualRefund()
    }
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
   * 退租原因选择
   */
  onReasonChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({
      reasonIndex: index,
      checkoutReason: this.data.reasonOptions[index]
    })
  },

  /**
   * 计算实际退款金额
   */
  calculateActualRefund() {
    const { depositRefund, finalBillAmount } = this.data
    const deposit = parseFloat(depositRefund) || 0
    const bill = parseFloat(finalBillAmount) || 0
    const actual = Math.max(0, deposit - bill)
    
    this.setData({
      actualRefund: actual.toString()
    })
  },

  /**
   * 表单验证
   */
  validateForm() {
    const errors = {}
    const { checkoutDate, finalWaterReading, finalElectricityReading, meterDate } = this.data
    
    if (!checkoutDate) {
      errors.checkoutDate = '请选择退租日期'
    }
    
    if (!meterDate) {
      errors.meterDate = '请选择抄表日期'
    }
    
    // 水电表读数验证（如果填写需要是有效数字且不小于当前读数）
    const currentWater = parseFloat(this.data.roomInfo?.lastWaterReading) || 0
    const currentElectricity = parseFloat(this.data.roomInfo?.lastElectricityReading) || 0
    
    if (finalWaterReading) {
      const waterValue = parseFloat(finalWaterReading)
      if (isNaN(waterValue) || waterValue < 0) {
        errors.finalWaterReading = '请输入有效的水表读数'
      } else if (waterValue < currentWater) {
        errors.finalWaterReading = '最终读数不能小于当前读数'
      }
    }
    
    if (finalElectricityReading) {
      const electricityValue = parseFloat(finalElectricityReading)
      if (isNaN(electricityValue) || electricityValue < 0) {
        errors.finalElectricityReading = '请输入有效的电表读数'
      } else if (electricityValue < currentElectricity) {
        errors.finalElectricityReading = '最终读数不能小于当前读数'
      }
    }
    
    this.setData({ errors })
    return Object.keys(errors).length === 0
  },

  /**
   * 确认退租
   */
  async confirmCheckout() {
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
        checkoutDate,
        checkoutReason,
        remark,
        finalWaterReading,
        finalElectricityReading,
        meterDate,
        depositRefund,
        finalBillAmount,
        actualRefund
      } = this.data
      
      // 调用退租登记云函数
      const res = await request.request({
        cloudFunc: 'room',
        data: {
          action: 'checkout',
          roomId: roomId,
          checkoutDate: checkoutDate,
          checkoutReason: checkoutReason,
          remark: remark || ''
        }
      })
      
      if (res && res.code === 200) {
        // 如果填写了水电表读数，更新最终读数
        if (finalWaterReading || finalElectricityReading) {
          try {
            await request.request({
              cloudFunc: 'room',
              data: {
                action: 'recordMeter',
                roomId: roomId,
                waterReading: parseFloat(finalWaterReading) || 0,
                electricityReading: parseFloat(finalElectricityReading) || 0
              }
            })
          } catch (meterError) {
            console.error('更新最终表读数失败:', meterError)
          }
        }
        
        wx.showToast({
          title: '退租登记成功',
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
        throw new Error(res.message || '退租登记失败')
      }
      
    } catch (error) {
      console.error('退租登记失败:', error)
      wx.showToast({
        title: error.message || '退租登记失败',
        icon: 'none'
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
      content: '确定要取消退租登记吗？',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack()
        }
      }
    })
  }
})