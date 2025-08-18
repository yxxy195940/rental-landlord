// pages/meter-init/meter-init.js
import request from '../../utils/request'

Page({
  data: {
    loading: false,
    submitting: false,
    buildingId: '',
    roomId: '', // 单个房间模式
    isSingleMode: false, // 是否单个房间模式
    buildingInfo: null,
    roomList: [],
    selectedRooms: [],
    recordDate: '',
    
    // 批量录入模式
    isBatchMode: true,
    batchWaterReading: '',
    batchElectricityReading: '',
    
    // 表单验证错误
    errors: {},
    
    // 统计信息
    totalRooms: 0,
    unsetRooms: 0
  },

  onLoad(options) {
    // 单个房间模式
    if (options.roomId && options.single === 'true') {
      this.setData({ 
        roomId: options.roomId,
        buildingId: options.buildingId || '',
        isSingleMode: true
      })
      this.initDefaultValues()
      this.loadSingleRoom()
    } 
    // 楼栋批量模式
    else if (options.buildingId) {
      this.setData({ 
        buildingId: options.buildingId,
        isSingleMode: false
      })
      this.initDefaultValues()
      this.loadBuildingRooms()
    } else {
      wx.showToast({
        title: '参数不完整',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  onPullDownRefresh() {
    if (this.data.isSingleMode) {
      this.loadSingleRoom()
    } else {
      this.loadBuildingRooms()
    }
  },

  /**
   * 加载单个房间信息
   */
  async loadSingleRoom() {
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
        // 单个房间模式，只显示当前房间
        const roomList = [res]
        
        this.setData({
          buildingInfo: { name: `${res.roomNumber}室` },
          roomList: roomList,
          selectedRooms: [res._id], // 默认选中当前房间
          totalRooms: 1,
          unsetRooms: (!res.initialWaterReading || !res.initialElectricityReading) ? 1 : 0,
          isBatchMode: false // 单个房间默认使用单独模式
        })
        
        wx.setNavigationBarTitle({
          title: `${res.roomNumber}室 - 初始抄表`
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
      wx.stopPullDownRefresh()
    }
  },

  /**
   * 初始化默认值
   */
  initDefaultValues() {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    
    this.setData({
      recordDate: today
    })
  },

  /**
   * 加载楼栋房间列表
   */
  async loadBuildingRooms() {
    try {
      this.setData({ loading: true })
      
      const res = await request.request({
        cloudFunc: 'room',
        data: {
          action: 'listByBuilding',
          buildingId: this.data.buildingId
        }
      })
      
      if (res && res.rooms) {
        // 筛选出未设置初始表数的房间
        const unsetRooms = res.rooms.filter(room => 
          !room.initialWaterReading || !room.initialElectricityReading
        )
        
        this.setData({
          buildingInfo: res.building,
          roomList: res.rooms,
          selectedRooms: unsetRooms.map(room => room._id), // 默认选中未设置的房间
          totalRooms: res.rooms.length,
          unsetRooms: unsetRooms.length
        })
        
        wx.setNavigationBarTitle({
          title: `${res.building?.name || '楼栋'} - 初始抄表`
        })
      }
    } catch (error) {
      console.error('加载房间列表失败:', error)
      wx.showToast({
        title: '加载房间列表失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
      wx.stopPullDownRefresh()
    }
  },

  /**
   * 切换录入模式
   */
  onModeChange() {
    this.setData({
      isBatchMode: !this.data.isBatchMode,
      batchWaterReading: '',
      batchElectricityReading: '',
      errors: {}
    })
    
    // 如果切换到单独模式，清空批量选择
    if (!this.data.isBatchMode) {
      this.setData({
        selectedRooms: []
      })
    }
  },

  /**
   * 选择全部房间
   */
  selectAllRooms() {
    const unsetRooms = this.data.roomList.filter(room => 
      !room.initialWaterReading || !room.initialElectricityReading
    )
    
    this.setData({
      selectedRooms: unsetRooms.map(room => room._id)
    })
  },

  /**
   * 清空选择
   */
  clearSelection() {
    this.setData({
      selectedRooms: []
    })
  },

  /**
   * 切换房间选择状态
   */
  onRoomSelect(e) {
    const { roomId } = e.currentTarget.dataset
    const { selectedRooms } = this.data
    
    let newSelectedRooms
    if (selectedRooms.includes(roomId)) {
      newSelectedRooms = selectedRooms.filter(id => id !== roomId)
    } else {
      newSelectedRooms = [...selectedRooms, roomId]
    }
    
    this.setData({
      selectedRooms: newSelectedRooms
    })
  },

  /**
   * 输入框变化处理
   */
  onInputChange(e) {
    const { field, roomId } = e.currentTarget.dataset
    const value = e.detail.value
    
    if (roomId) {
      // 单独房间输入
      const roomList = this.data.roomList.map(room => {
        if (room._id === roomId) {
          return {
            ...room,
            [field]: value
          }
        }
        return room
      })
      
      this.setData({
        roomList,
        [`errors.${roomId}.${field}`]: ''
      })
    } else {
      // 批量输入
      this.setData({
        [field]: value,
        [`errors.${field}`]: ''
      })
    }
  },

  /**
   * 日期选择
   */
  onDateChange(e) {
    this.setData({
      recordDate: e.detail.value,
      'errors.recordDate': ''
    })
  },

  /**
   * 表单验证
   */
  validateForm() {
    const errors = {}
    const { recordDate, selectedRooms, isBatchMode, batchWaterReading, batchElectricityReading, roomList } = this.data
    
    if (!recordDate) {
      errors.recordDate = '请选择记录日期'
    }
    
    if (selectedRooms.length === 0) {
      errors.selection = '请选择要设置的房间'
    }
    
    if (isBatchMode) {
      // 批量模式验证
      if (!batchWaterReading) {
        errors.batchWaterReading = '请输入水表读数'
      } else if (isNaN(parseFloat(batchWaterReading)) || parseFloat(batchWaterReading) < 0) {
        errors.batchWaterReading = '请输入有效的水表读数'
      }
      
      if (!batchElectricityReading) {
        errors.batchElectricityReading = '请输入电表读数'
      } else if (isNaN(parseFloat(batchElectricityReading)) || parseFloat(batchElectricityReading) < 0) {
        errors.batchElectricityReading = '请输入有效的电表读数'
      }
    } else {
      // 单独模式验证
      selectedRooms.forEach(roomId => {
        const room = roomList.find(r => r._id === roomId)
        if (room) {
          if (!room.tempWaterReading) {
            if (!errors[roomId]) errors[roomId] = {}
            errors[roomId].tempWaterReading = '请输入水表读数'
          } else if (isNaN(parseFloat(room.tempWaterReading)) || parseFloat(room.tempWaterReading) < 0) {
            if (!errors[roomId]) errors[roomId] = {}
            errors[roomId].tempWaterReading = '请输入有效的水表读数'
          }
          
          if (!room.tempElectricityReading) {
            if (!errors[roomId]) errors[roomId] = {}
            errors[roomId].tempElectricityReading = '请输入电表读数'
          } else if (isNaN(parseFloat(room.tempElectricityReading)) || parseFloat(room.tempElectricityReading) < 0) {
            if (!errors[roomId]) errors[roomId] = {}
            errors[roomId].tempElectricityReading = '请输入有效的电表读数'
          }
        }
      })
    }
    
    this.setData({ errors })
    return Object.keys(errors).length === 0
  },

  /**
   * 提交初始表数
   */
  async submitMeterInit() {
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
        selectedRooms,
        recordDate,
        isBatchMode,
        batchWaterReading,
        batchElectricityReading,
        roomList
      } = this.data
      
      // 准备批量更新数据
      const meterRecords = selectedRooms.map(roomId => {
        const room = roomList.find(r => r._id === roomId)
        
        return {
          roomId: roomId,
          roomNumber: room.roomNumber,
          waterReading: isBatchMode 
            ? parseFloat(batchWaterReading) 
            : parseFloat(room.tempWaterReading),
          electricityReading: isBatchMode 
            ? parseFloat(batchElectricityReading) 
            : parseFloat(room.tempElectricityReading),
          recordDate: recordDate,
          isInitial: true
        }
      })
      
      const res = await request.request({
        cloudFunc: 'meter',
        data: {
          action: 'batchInitRecord',
          buildingId: this.data.buildingId,
          records: meterRecords
        }
      })
      
      if (res && res.code === 200) {
        wx.showToast({
          title: `成功设置${meterRecords.length}间房间`,
          icon: 'success'
        })
        
        setTimeout(() => {
          wx.navigateBack({
            success: () => {
              // 通知前一个页面刷新数据
              const pages = getCurrentPages()
              if (pages.length > 1) {
                const prevPage = pages[pages.length - 2]
                if (prevPage.loadRoomList) {
                  prevPage.loadRoomList()
                }
              }
            }
          })
        }, 1500)
        
      } else {
        throw new Error(res.message || '设置初始表数失败')
      }
      
    } catch (error) {
      console.error('设置初始表数失败:', error)
      wx.showToast({
        title: error.message || '设置初始表数失败',
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
      content: '确定要取消初始抄表吗？',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack()
        }
      }
    })
  }
})