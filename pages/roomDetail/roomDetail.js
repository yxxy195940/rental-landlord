// pages/roomDetail/roomDetail.js
import request from '../../utils/request';
import { log } from '../../utils/config';

Page({
  data: {
    loading: true,
    roomDetail: null,
    error: null,
    roomId: null,
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ roomId: options.id });
      this.loadRoomDetail(options.id);
    } else {
      this.setData({ 
        loading: false,
        error: '无效的房间ID' 
      });
      wx.showToast({
        title: '无效的房间ID',
        icon: 'none'
      });
    }
  },

  async loadRoomDetail(roomId) {
    this.setData({ loading: true, error: null });
    try {
      const res = await request.request({
        cloudFunc: 'room',
        data: {
          action: 'detail',
          roomId: roomId,
        }
      });
      
      if (res) {
        console.log('📋 加载的房间数据:', res);
        console.log('💰 费用配置字段检查:', {
          monthlyRent: res.monthlyRent,
          deposit: res.deposit,
          managementFee: res.managementFee,
          sanitationFee: res.sanitationFee,
          internetFee: res.internetFee,
          otherFee: res.otherFee,
          feeRemark: res.feeRemark
        });
        this.setData({
          roomDetail: res,
          loading: false,
        });
        wx.setNavigationBarTitle({
          title: res.roomNumber ? `${res.roomNumber}室详情` : '房间详情',
        });
        
        // 调试：输出房间状态
        console.log('房间状态:', res.status);
        console.log('主要按钮信息:', this.getMainActionButton());
      } else {
        throw new Error('未找到房间信息');
      }
    } catch (error) {
      log('error', `加载房间详情失败 (ID: ${roomId})`, error);
      this.setData({
        loading: false,
        error: error.message || '加载详情失败',
      });
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      });
    }
  },

  onPullDownRefresh() {
    if (this.data.roomId) {
      this.loadRoomDetail(this.data.roomId).then(() => {
        wx.stopPullDownRefresh();
      });
    } else {
      wx.stopPullDownRefresh();
    }
  },

  /**
   * 临时方法：迁移费用字段
   */
  async migrateFeeFields() {
    try {
      console.log('开始执行费用字段迁移...')
      wx.showLoading({ title: '迁移中...' })
      
      const res = await request.request({
        cloudFunc: 'room',
        data: {
          action: 'migrateFeeFields'
        }
      })
      
      wx.hideLoading()
      console.log('迁移结果:', res)
      
      wx.showModal({
        title: '迁移完成',
        content: `共检查 ${res.totalRooms} 间房间，更新了 ${res.updatedRooms} 间房间的费用字段`,
        showCancel: false,
        success: () => {
          // 重新加载房间详情
          this.loadRoomDetail(this.data.roomId)
        }
      })
      
    } catch (error) {
      wx.hideLoading()
      console.error('迁移失败:', error)
      wx.showToast({
        title: '迁移失败',
        icon: 'none'
      })
    }
  },


  /**
   * 获取房间状态文本
   */
  getRoomStatusText(status) {
    const statusMap = {
      1: '未登记',
      2: '已出租', 
      3: '维修中'
    }
    return statusMap[status] || '未知'
  },

  /**
   * 获取房间状态图标
   */
  getRoomStatusIcon(status) {
    const iconMap = {
      1: '🟡',
      2: '🟢',
      3: '🔧'
    }
    return iconMap[status] || '❓'
  },

  /**
   * 获取主要操作按钮信息
   */
  getMainActionButton() {
    const room = this.data.roomDetail
    if (!room) return null

    switch (room.status) {
      case 1: // 空置
        return {
          text: '出租登记',
          type: 'primary',
          action: 'rentRegister'
        }
      case 2: // 已出租
        return {
          text: '退租登记', 
          type: 'danger',
          action: 'checkoutRegister'
        }
      case 3: // 维修中
        return {
          text: '完成维修',
          type: 'success', 
          action: 'finishMaintenance'
        }
      default:
        return null
    }
  },

  /**
   * 出租登记
   */
  rentRegister() {
    console.log('开始出租登记')
    const roomId = this.data.roomId
    console.log('房间ID:', roomId)
    
    if (!roomId) {
      wx.showToast({
        title: '房间ID无效',
        icon: 'none'
      })
      return
    }
    
    console.log('跳转到出租登记页面')
    wx.navigateTo({
      url: `/pages/rent-register/rent-register?roomId=${roomId}`,
      success: () => {
        console.log('导航成功')
      },
      fail: (error) => {
        console.error('导航失败:', error)
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 退租登记
   */
  checkoutRegister() {
    const roomId = this.data.roomId
    wx.navigateTo({
      url: `/pages/checkout-register/checkout-register?roomId=${roomId}`
    })
  },

  /**
   * 完成维修
   */
  async finishMaintenance() {
    wx.showModal({
      title: '完成维修',
      content: '确认该房间维修完成，状态将变更为空置？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await request.request({
              cloudFunc: 'room',
              data: {
                action: 'updateStatus',
                roomId: this.data.roomId,
                status: 1 // 改为空置状态
              }
            })
            
            wx.showToast({
              title: '状态已更新',
              icon: 'success'
            })
            
            // 重新加载房间详情
            this.loadRoomDetail(this.data.roomId)
            
          } catch (error) {
            wx.showToast({
              title: '操作失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  /**
   * 更新登记信息
   */
  updateRegisterInfo() {
    const roomId = this.data.roomId
    wx.navigateTo({
      url: `/pages/update-register/update-register?roomId=${roomId}`
    })
  },

  /**
   * 主要操作按钮处理
   */
  handleMainAction() {
    console.log('主要操作按钮被点击')
    const actionButton = this.getMainActionButton()
    console.log('动作按钮信息:', actionButton)
    
    if (!actionButton) {
      console.log('未找到动作按钮信息')
      return
    }

    console.log('执行动作:', actionButton.action)
    switch (actionButton.action) {
      case 'rentRegister':
        console.log('执行出租登记')
        this.rentRegister()
        break
      case 'checkoutRegister':
        console.log('执行退租登记')
        this.checkoutRegister()
        break
      case 'finishMaintenance':
        console.log('执行完成维修')
        this.finishMaintenance()
        break
      default:
        console.log('未知动作:', actionButton.action)
    }
  },

  /**
   * 查看抄表历史
   */
  viewMeterHistory() {
    const roomId = this.data.roomId
    wx.navigateTo({
      url: `/pages/meter-history/meter-history?roomId=${roomId}`
    })
  },

  /**
   * 编辑房间信息
   */
  editRoom() {
    wx.navigateTo({
      url: `/pages/room-edit/room-edit?roomId=${this.data.roomId}`,
    });
  },

  /**
   * 格式化日期显示
   */
  formatDate(dateStr) {
    if (!dateStr) return '--'
    const date = new Date(dateStr)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  },

  /**
   * 拨打电话
   */
  makePhoneCall() {
    const phone = this.data.roomDetail?.tenantPhone
    if (!phone) {
      wx.showToast({
        title: '暂无联系电话',
        icon: 'none'
      })
      return
    }
    
    wx.makePhoneCall({
      phoneNumber: phone
    })
  }
});
