// pages/batch-rent/batch-rent.js
import request from '../../utils/request'

Page({
  data: {
    loading: false,
    submitting: false,
    buildingId: '',
    buildingInfo: null,
    vacantRooms: [],
    selectedRooms: [],
    expandedRooms: [], // 展开的房间卡片
    
    // 统计信息
    totalVacant: 0,
    selectedCount: 0
  },

  onLoad(options) {
    if (options.buildingId) {
      this.setData({ buildingId: options.buildingId })
      this.loadVacantRooms()
    } else {
      wx.showToast({
        title: '楼栋ID不能为空',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  onPullDownRefresh() {
    this.loadVacantRooms()
  },

  /**
   * 加载未登记房间列表
   */
  async loadVacantRooms() {
    try {
      this.setData({ loading: true })
      
      const res = await request.request({
        cloudFunc: 'room',
        data: {
          action: 'listByBuilding',
          buildingId: this.data.buildingId,
          status: 1 // 只获取未登记房间
        }
      })
      
      if (res && res.rooms) {
        // 为每个房间初始化表单数据
        const roomsWithFormData = res.rooms.map(room => ({
          ...room,
          // 确保roomNumber字段存在
          roomNumber: room.roomNumber || room.roomName || '',
          // 租客信息
          tenantName: '',
          tenantPhone: '',
          monthlyRent: room.monthlyRent || '',
          remark: '',
          // 水电表信息
          currentWaterReading: '',
          currentElectricityReading: '',
          meterDate: this.getTodayDate(),
          // 验证错误
          errors: {}
        }))
        
        this.setData({
          buildingInfo: res.building,
          vacantRooms: roomsWithFormData,
          totalVacant: roomsWithFormData.length,
          selectedCount: 0,
          selectedRooms: []
        })
        
        wx.setNavigationBarTitle({
          title: `${res.building?.name || '楼栋'} - 批量出租登记`
        })
      }
    } catch (error) {
      console.error('加载未登记房间失败:', error)
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
   * 获取今天日期
   */
  getTodayDate() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  },

  /**
   * 房间头部点击 - 根据选中状态决定行为
   */
  onRoomHeaderTap(e) {
    const { roomId } = e.currentTarget.dataset
    const { selectedRooms, expandedRooms } = this.data
    
    const isCurrentlySelected = selectedRooms.indexOf(roomId) !== -1
    const isCurrentlyExpanded = expandedRooms.indexOf(roomId) !== -1
    
    if (isCurrentlySelected) {
      // 如果已选中，只切换展开/收起状态
      let newExpandedRooms
      if (isCurrentlyExpanded) {
        newExpandedRooms = expandedRooms.filter(id => id !== roomId)
      } else {
        newExpandedRooms = expandedRooms.concat([roomId])
      }
      
      this.setData({
        expandedRooms: newExpandedRooms
      })
    } else {
      // 如果未选中，选中并展开
      const newSelectedRooms = selectedRooms.concat([roomId])
      const newExpandedRooms = isCurrentlyExpanded ? expandedRooms : expandedRooms.concat([roomId])
      
      this.setData({
        selectedRooms: newSelectedRooms,
        selectedCount: newSelectedRooms.length,
        expandedRooms: newExpandedRooms
      })
    }
  },

  /**
   * 选择/取消选择房间（保留用于其他地方调用）
   */
  onRoomSelect(e) {
    const { roomId } = e.currentTarget.dataset
    const { selectedRooms } = this.data
    
    let newSelectedRooms
    const index = selectedRooms.indexOf(roomId)
    if (index !== -1) {
      newSelectedRooms = selectedRooms.filter(id => id !== roomId)
    } else {
      newSelectedRooms = selectedRooms.concat([roomId])
    }
    
    this.setData({
      selectedRooms: newSelectedRooms,
      selectedCount: newSelectedRooms.length
    })
  },

  /**
   * 展开/收起房间详情（保留用于其他地方调用）
   */
  onRoomExpand(e) {
    const { roomId } = e.currentTarget.dataset
    const { expandedRooms } = this.data
    
    let newExpandedRooms
    const index = expandedRooms.indexOf(roomId)
    if (index !== -1) {
      newExpandedRooms = expandedRooms.filter(id => id !== roomId)
    } else {
      newExpandedRooms = expandedRooms.concat([roomId])
    }
    
    this.setData({ expandedRooms: newExpandedRooms })
  },

  /**
   * 展开/收起切换（专门给展开按钮使用）
   */
  onExpandToggle(e) {
    const { roomId } = e.currentTarget.dataset
    const { expandedRooms } = this.data
    
    let newExpandedRooms
    const index = expandedRooms.indexOf(roomId)
    if (index !== -1) {
      newExpandedRooms = expandedRooms.filter(id => id !== roomId)
    } else {
      newExpandedRooms = expandedRooms.concat([roomId])
    }
    
    this.setData({ expandedRooms: newExpandedRooms })
  },

  /**
   * 全部展开/全部收起
   */
  toggleExpandAll() {
    const { expandedRooms, vacantRooms } = this.data
    
    if (expandedRooms.length === vacantRooms.length) {
      // 当前是全部展开状态，全部收起
      this.setData({
        expandedRooms: []
      })
    } else {
      // 全部展开
      const allRoomIds = vacantRooms.map(room => room._id)
      this.setData({
        expandedRooms: allRoomIds
      })
    }
  },

  /**
   * 全选/取消全选（保留备用）
   */
  toggleSelectAll() {
    const { selectedRooms, vacantRooms } = this.data
    
    if (selectedRooms.length === vacantRooms.length) {
      // 当前是全选状态，取消全选
      this.setData({
        selectedRooms: [],
        selectedCount: 0
      })
    } else {
      // 全选
      const allRoomIds = vacantRooms.map(room => room._id)
      this.setData({
        selectedRooms: allRoomIds,
        selectedCount: allRoomIds.length
      })
    }
  },

  /**
   * 输入框变化处理
   */
  onInputChange(e) {
    const { roomId, field } = e.currentTarget.dataset
    const value = e.detail.value
    
    const vacantRooms = this.data.vacantRooms.map(room => {
      if (room._id === roomId) {
        return {
          ...room,
          [field]: value,
          errors: {
            ...room.errors,
            [field]: ''
          }
        }
      }
      return room
    })
    
    this.setData({ vacantRooms })
    
    // 检查并自动选择已填写的房间
    this.checkAndAutoSelectRoom(roomId)
  },

  /**
   * 日期选择
   */
  onDateChange(e) {
    const { roomId, field } = e.currentTarget.dataset
    const value = e.detail.value
    
    const vacantRooms = this.data.vacantRooms.map(room => {
      if (room._id === roomId) {
        return {
          ...room,
          [field]: value,
          errors: {
            ...room.errors,
            [field]: ''
          }
        }
      }
      return room
    })
    
    this.setData({ vacantRooms })
    
    // 检查并自动选择已填写的房间
    this.checkAndAutoSelectRoom(roomId)
  },

  /**
   * 检查并自动选择已填写的房间
   */
  checkAndAutoSelectRoom(roomId) {
    const { selectedRooms, vacantRooms, expandedRooms } = this.data
    const room = vacantRooms.find(r => r._id === roomId)
    
    if (!room) return
    
    // 检查房间是否有水电表读数（现在是必填项）
    const hasImportantInfo = room.currentWaterReading || room.currentElectricityReading
    
    const isCurrentlySelected = selectedRooms.indexOf(roomId) !== -1
    const isCurrentlyExpanded = expandedRooms.indexOf(roomId) !== -1
    
    // 如果填写了重要信息但未选中，自动选中并展开
    if (hasImportantInfo && !isCurrentlySelected) {
      const newSelectedRooms = selectedRooms.concat([roomId])
      const newExpandedRooms = isCurrentlyExpanded ? expandedRooms : expandedRooms.concat([roomId])
      this.setData({
        selectedRooms: newSelectedRooms,
        selectedCount: newSelectedRooms.length,
        expandedRooms: newExpandedRooms
      })
    }
    // 不自动取消选中，让用户手动控制
  },

  /**
   * 验证单个房间表单
   */
  validateRoomForm(room) {
    const errors = {}
    
    // 租客信息验证（可选，但如果填写需要格式正确）
    const hasPhone = room.tenantPhone && room.tenantPhone.trim()
    
    // 如果填写了手机号，验证格式
    if (hasPhone && !/^1[3-9]\d{9}$/.test(room.tenantPhone)) {
      errors.tenantPhone = '请输入正确的手机号格式'
    }
    
    // 月租金不再必填，只需要有水电表读数或租客信息即可
    // if (!room.monthlyRent || parseFloat(room.monthlyRent) <= 0) {
    //   errors.monthlyRent = '请输入有效的月租金'
    // }
    
    // 水电表读数验证（必填）
    if (!room.currentWaterReading || room.currentWaterReading.trim() === '') {
      errors.currentWaterReading = '请输入水表读数'
    } else if (isNaN(room.currentWaterReading) || parseFloat(room.currentWaterReading) < 0) {
      errors.currentWaterReading = '请输入有效的水表读数'
    }
    
    if (!room.currentElectricityReading || room.currentElectricityReading.trim() === '') {
      errors.currentElectricityReading = '请输入电表读数'
    } else if (isNaN(room.currentElectricityReading) || parseFloat(room.currentElectricityReading) < 0) {
      errors.currentElectricityReading = '请输入有效的电表读数'
    }
    
    return errors
  },

  /**
   * 批量提交出租登记
   */
  async batchSubmitRent() {
    const { selectedRooms, vacantRooms } = this.data
    
    if (selectedRooms.length === 0) {
      wx.showToast({
        title: '请选择要出租的房间',
        icon: 'none'
      })
      return
    }
    
    // 验证选中房间的表单
    const selectedRoomData = vacantRooms.filter(room => selectedRooms.indexOf(room._id) !== -1)
    let hasError = false
    
    const updatedRooms = vacantRooms.map(room => {
      if (selectedRooms.indexOf(room._id) !== -1) {
        const errors = this.validateRoomForm(room)
        if (Object.keys(errors).length > 0) {
          hasError = true
        }
        return { ...room, errors }
      }
      return room
    })
    
    this.setData({ vacantRooms: updatedRooms })
    
    if (hasError) {
      wx.showToast({
        title: '请检查表单信息',
        icon: 'none'
      })
      return
    }
    
    // 确认提交
    wx.showModal({
      title: '确认批量出租',
      content: `确定要为${selectedRooms.length}间房间办理出租登记吗？`,
      success: async (res) => {
        if (res.confirm) {
          await this.performBatchRent(selectedRoomData)
        }
      }
    })
  },

  /**
   * 执行批量出租登记
   */
  async performBatchRent(roomData) {
    this.setData({ submitting: true })
    
    try {
      const batchRequests = roomData.map(room => ({
        action: 'rent',
        roomId: room._id,
        tenantName: room.tenantName ? room.tenantName.trim() : null,
        tenantPhone: room.tenantPhone ? room.tenantPhone.trim() : null,
        tenantIdCard: '',
        contractStartDate: null, // 不更新入住日期
        monthlyRent: room.monthlyRent ? parseFloat(room.monthlyRent) : null, // 可为空
        deposit: null, // 不更新押金
        remark: room.remark || '',
        lastWaterReading: (room.currentWaterReading && !isNaN(parseFloat(room.currentWaterReading))) ? parseFloat(room.currentWaterReading) : null,
        lastElectricityReading: (room.currentElectricityReading && !isNaN(parseFloat(room.currentElectricityReading))) ? parseFloat(room.currentElectricityReading) : null,
        meterDate: room.meterDate || null
      }))
      
      // 并发处理多个房间的出租登记
      const results = await Promise.allSettled(
        batchRequests.map(data => 
          request.request({
            cloudFunc: 'room',
            data: data
          })
        )
      )
      
      // 统计结果
      let successCount = 0
      let failedCount = 0
      const failedRooms = []
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++
        } else {
          failedCount++
          const errorMessage = result.status === 'rejected' 
            ? (result.reason?.message || '网络请求失败')
            : (result.value?.message || `登记失败，错误码：${result.value?.code || 'unknown'}`)
          
          failedRooms.push({
            roomNumber: roomData[index].roomNumber,
            error: errorMessage
          })
          
          console.error(`房间${roomData[index].roomNumber}登记失败:`, {
            status: result.status,
            value: result.value,
            reason: result.reason
          })
        }
      })
      
      // 显示结果
      if (successCount > 0) {
        wx.showToast({
          title: `成功登记${successCount}间房间`,
          icon: 'success'
        })
      }
      
      if (failedCount > 0) {
        console.error('部分房间登记失败:', failedRooms)
        wx.showModal({
          title: '部分登记失败',
          content: `${failedCount}间房间登记失败，请检查后重试`,
          showCancel: false
        })
      }
      
      // 刷新页面
      setTimeout(() => {
        if (successCount > 0) {
          this.loadVacantRooms()
        }
      }, 1500)
      
    } catch (error) {
      console.error('批量出租登记失败:', error)
      wx.showToast({
        title: '批量登记失败',
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
      content: '确定要取消批量出租登记吗？',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack()
        }
      }
    })
  }
})