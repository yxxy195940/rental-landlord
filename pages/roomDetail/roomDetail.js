// pages/roomDetail/roomDetail.js
import request from '../../utils/request';
import { log } from '../../utils/config';

Page({
  data: {
    loading: true,
    roomDetail: null,
    error: null,
    roomId: null,
    
    // 批量复制功能
    showCopyDialog: false,
    copySettings: {
      copyCount: 1,
      generatedRooms: []
    },
    baseRoomForCopy: null // 用于复制的基础房间数据
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
      1: '空置',
      2: '已出租'
    }
    return statusMap[status] || '未知'
  },

  /**
   * 获取房间状态图标
   */
  getRoomStatusIcon(status) {
    const iconMap = {
      1: '🟢',
      2: '🔴'
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
   * 预览生成本月账单
   */
  previewCurrentBill() {
    const roomId = this.data.roomId;
    const now = new Date();
    const billMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    wx.navigateTo({
      url: `/pages/bill-create/bill-create?roomId=${roomId}&billMonth=${billMonth}`
    });
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
  },

  // --- 批量复制功能 ---

  /**
   * 复制弹窗字段变化处理
   */
  onCopyFieldChange(event) {
    const field = event.currentTarget.dataset.field
    let value = event.detail ? event.detail.value : event.currentTarget.dataset.value
    
    if (field) {
      this.setData({ [field]: value });
    }
  },

  /**
   * 显示批量复制对话框
   */
  showCopyDialog() {
    const room = this.data.roomDetail;
    if (!room) return;
    
    // 构造基础房间数据，用于复制
    // 注意：这里构造的结构需要与 room-edit.js 中的 room 结构一致，特别是 feeStandard
    const baseRoomForCopy = {
      buildingId: room.buildingId,
      buildingName: room.buildingName,
      roomNumber: room.roomNumber,
      feeStandard: {
        monthlyRent: room.monthlyRent || '',
        deposit: room.deposit || '',
        electricityPrice: room.electricityPrice || '',
        waterPrice: room.waterPrice || '',
        internetFee: room.internetFee || '',
        sanitationFee: room.sanitationFee || '',
        managementFee: room.managementFee || '',
        otherFee: room.otherFee || ''
      },
      remarks: room.remarks || '',
      status: 1, // 默认为空置
      isAvailable: true
    };

    this.setData({
      showCopyDialog: true,
      baseRoomForCopy: baseRoomForCopy,
      copySettings: {
        copyCount: 1,
        generatedRooms: []
      }
    })
  },

  /**
   * 关闭批量复制对话框
   */
  closeCopyDialog() {
    this.setData({
      showCopyDialog: false,
      baseRoomForCopy: null
    })
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation() {
    // 什么都不做，只是阻止事件冒泡
  },

  /**
   * 生成批量房间列表
   */
  generateRoomList() {
    const room = this.data.baseRoomForCopy;
    const { copySettings } = this.data;
    const { copyCount } = copySettings;
    
    if (!room) return;

    const baseRoomNumberStr = room.roomNumber ? String(room.roomNumber) : '';
    const generatedRooms = [];
    
    if (!baseRoomNumberStr || !/^\d+$/.test(baseRoomNumberStr)) {
      wx.showToast({ title: '原房间号格式不正确', icon: 'none' });
      return;
    }

    const baseRoomNumber = parseInt(baseRoomNumberStr);
    
    if (copyCount < 1) {
      wx.showToast({ title: '请输入有效的复制数量', icon: 'none' });
      return;
    }
    for (let i = 1; i <= copyCount; i++) {
      const newRoomNumber = baseRoomNumber + i;
      generatedRooms.push({
        ...JSON.parse(JSON.stringify(room)), // Deep copy
        roomNumber: newRoomNumber.toString(),
        id: `temp_${newRoomNumber}`
      });
    }

    this.setData({
      'copySettings.generatedRooms': generatedRooms
    });
  },

  /**
   * 修改生成的房间信息
   */
  onGeneratedRoomFieldChange(event) {
    const { index, field } = event.currentTarget.dataset;
    const value = event.detail.value;
    const generatedRooms = [...this.data.copySettings.generatedRooms];
    const roomToUpdate = generatedRooms[index];

    if (roomToUpdate) {
      const fieldPath = field.split('.');
      let current = roomToUpdate;
      for (let i = 0; i < fieldPath.length - 1; i++) {
        current = current[fieldPath[i]];
      }
      current[fieldPath[fieldPath.length - 1]] = value;

      this.setData({
        'copySettings.generatedRooms': generatedRooms
      });
    }
  },

  /**
   * 格式化房间数据用于保存
   */
  formatRoomData(room) {
    return {
      buildingId: room.buildingId,
      buildingName: room.buildingName,
      roomNumber: room.roomNumber,
      feeStandard: {
        monthlyRent: parseFloat(room.feeStandard.monthlyRent) || 0,
        deposit: parseFloat(room.feeStandard.deposit) || 0,
        electricityPrice: parseFloat(room.feeStandard.electricityPrice) || 0.8,
        waterPrice: parseFloat(room.feeStandard.waterPrice) || 4.5,
        internetFee: parseFloat(room.feeStandard.internetFee) || 0,
        sanitationFee: parseFloat(room.feeStandard.sanitationFee) || 0,
        managementFee: parseFloat(room.feeStandard.managementFee) || 0,
        otherFee: parseFloat(room.feeStandard.otherFee) || 0
      },
      remarks: room.remarks || '',
      status: room.status || 1,
      isAvailable: room.isAvailable !== false
    }
  },

  /**
   * 批量保存房间
   */
  async batchSaveRooms() {
    const { copySettings } = this.data
    const { generatedRooms } = copySettings
    
    if (generatedRooms.length === 0) {
      wx.showToast({
        title: '没有要保存的房间',
        icon: 'none'
      })
      return
    }
    
    try {
      this.setData({ saving: true })
      wx.showLoading({ title: '保存中...' })
      
      // 批量保存复制的房间
      const batchResponse = await request.request({
        cloudFunc: 'room',
        data: {
          action: 'batchCreate',
          roomList: generatedRooms.map(r => this.formatRoomData(r))
        }
      })
      
      wx.hideLoading()
      
      if (batchResponse) {
        wx.showToast({
          title: `成功创建${generatedRooms.length}个房间`,
          icon: 'success'
        })
        
        this.closeCopyDialog()
      }
    } catch (error) {
      wx.hideLoading()
      console.error('批量保存房间失败:', error)
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    } finally {
      this.setData({ saving: false })
    }
  }
});
