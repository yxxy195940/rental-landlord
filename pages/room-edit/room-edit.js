// pages/room-edit/room-edit.js
/**
 * 房间编辑页面
 * 
 * 功能说明：
 * 1. 楼栋管理（添加/编辑/删除楼栋）
 * 2. 房间基础信息编辑
 * 3. 费用标准设置（月租金、押金、电费、水费、网费）
 * 4. 房间设施配置（可选）
 * 5. 房型批量复制功能
 */

import request from '../../utils/request'
import { formatUtils, validateUtils, businessUtils } from '../../utils/util'

// 获取应用实例
const app = getApp()

Page({
  /**
   * 页面的初始数据
   */
  data: {
    loading: false,
    saving: false,
    isEdit: false,        // 是否为编辑模式
    roomId: '',           // 房间ID
    
    // 楼栋管理
    buildingList: [],     // 楼栋列表
    selectedBuilding: {}, // 选中的楼栋
    showBuildingDialog: false,
    buildingForm: {
      id: '',
      name: '',
      address: '',
      floors: 4
    },
    
    // 楼栋信息编辑
    editingBuilding: false,
    editingBuildingData: {},
    
    // 房间数据（简化后）
    room: {
      // 基础信息
      buildingId: '',      // 所属楼栋ID
      buildingName: '',    // 楼栋名称
      roomNumber: '',      // 房间号（纯数字）
      
      // 费用标准（简化）
      feeStandard: {
        monthlyRent: '',     // 月租金
        deposit: '',         // 押金
        electricityPrice: '0.8',  // 电费单价
        waterPrice: '4.5',   // 水费单价
        internetFee: '',      // 网费（可选）
        sanitationFee: '',   // 卫生费
        managementFee: '',   // 管理费
        otherFee: ''         // 其他费用
      },
      
      
      // 其他条款
      remarks: '',         // 备注其他条款补充
      
      // 状态信息
      status: 1,           // 1-空置 2-已租
      isAvailable: true
    },
    
    // 界面显示控制
    showRoomSections: false,  // 是否显示房间信息区域
    
    // 批量复制功能
    showCopyDialog: false,
    copySettings: {
      copyCount: 1,        // 复制数量
      multiFloor: false,   // 是否多层生成
      generatedRooms: []   // 生成的房间列表
    },
    
    // 选项数据
    directionOptions: ['南向', '北向', '东向', '西向', '南北向', '东西向'],
    decorationOptions: ['毛坯', '简装', '精装', '豪装'],
    
    
    // 表单验证
    errors: {}
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('房间编辑页面加载', options)
    
    const { roomId, buildingId } = options
    const isEdit = !!roomId;

    this.setData({
      roomId: roomId || '',
      isEdit: isEdit,
      showRoomSections: true, // 无论是新增还是编辑，都直接显示表单
    })
    
    if (isEdit) {
      // 编辑模式：直接加载房间详情
      this.loadRoomDetail(roomId);
    } else {
      // 新增模式：需要加载楼栋列表以确定房间所属
      this.loadBuildingList().then(() => {
        const targetBuilding = this.data.buildingList.find(b => b.id === buildingId);
        if (targetBuilding) {
            this.initNewRoom(targetBuilding);
        } else {
            wx.showToast({ title: '未找到所属楼栋信息', icon: 'none' });
        }
      });
    }
    
    wx.setNavigationBarTitle({
      title: isEdit ? '编辑房间' : '添加房间'
    })
  },

  /**
   * 加载楼栋列表（仅新增时需要）
   */
  async loadBuildingList() {
    try {
      const response = await request.request({
        cloudFunc: 'building',
        data: { action: 'list' }
      });
      this.setData({ buildingList: response.list || [] });
    } catch (error) {
      console.error('加载楼栋列表失败:', error);
      wx.showToast({ title: '楼栋列表加载失败', icon: 'none' });
    }
  },

  /**
   * 初始化新房间
   */
  initNewRoom(building) {
    this.setData({
      'room.buildingId': building.id,
      'room.buildingName': building.name,
      selectedBuilding: building,
    });
  },

  /**
   * 加载房间详情
   */
  async loadRoomDetail(roomId) {
    try {
      this.setData({ loading: true });
      const roomData = await request.request({
        cloudFunc: 'room',
        data: {
          action: 'detail',
          roomId: roomId
        }
      });
      
      if (roomData) {
        this.setData({
          room: this.transformToFormData(roomData),
          loading: false
        });
      } else {
        throw new Error('未找到房间数据');
      }
    } catch (error) {
      console.error('加载房间详情失败:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载详情失败',
        icon: 'none'
      });
    }
  },

  /**
   * 转换API数据到表单数据
   */
  transformToFormData(data) {
    // 从云函数详情接口拿到的数据结构进行转换
    return {
      buildingId: data.buildingId || '',
      buildingName: data.buildingName || '',
      roomNumber: data.roomNumber || '',
      feeStandard: {
        monthlyRent: data.monthlyRent || '',
        deposit: data.deposit || '',
        electricityPrice: data.electricityPrice || '0.8',
        waterPrice: data.waterPrice || '4.5',
        internetFee: data.internetFee || '',
        sanitationFee: data.sanitationFee || '',
        managementFee: data.managementFee || '',
        otherFee: data.otherFee || ''
      },
      remarks: data.description || '', // 后端是description
      status: data.status || 1,
      isAvailable: data.isAvailable !== false
    };
  },

  /**
   * 表单字段变化处理
   */
  onFieldChange(event) {
    const field = event.currentTarget.dataset.field
    const value = event.detail.value
    
    if (!field) {
      console.error('字段名未定义:', event.currentTarget.dataset)
      return
    }
    
    console.log('字段变化:', field, value)
    
    const fieldPath = field.split('.')
    const newRoom = { ...this.data.room }
    
    // 处理嵌套字段
    if (fieldPath.length > 1) {
      let current = newRoom
      for (let i = 0; i < fieldPath.length - 1; i++) {
        if (!current[fieldPath[i]]) {
          current[fieldPath[i]] = {}
        }
        current = current[fieldPath[i]]
      }
      current[fieldPath[fieldPath.length - 1]] = value
    } else {
      // 处理顶级字段
      newRoom[field] = value
    }
    
    // 房间号变化时自动计算楼层（用于批量复制等功能）
    if (field === 'roomNumber' && value.length >= 3) {
      const roomNum = parseInt(value)
      const floor = Math.floor(roomNum / 100)
      if (floor > 0) {
        newRoom.floor = floor
      }
    }
    
    this.setData({
      room: newRoom
    })
    
    // 清除该字段的错误信息
    this.clearFieldError(field)
  },

  /**
   * 深度合并对象
   */
  deepMerge(target, source) {
    const result = { ...target }
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key])
      } else {
        result[key] = source[key]
      }
    }
    
    return result
  },

  /**
   * 清除字段错误
   */
  clearFieldError(field) {
    const errors = { ...this.data.errors }
    delete errors[field]
    this.setData({ errors })
  },

  /**
   * 表单验证（简化）
   */
  validateForm() {
    const { room } = this.data
    const errors = {}
    
    // 基础信息验证
    if (!room.roomNumber) {
      errors['roomNumber'] = '请输入房间号'
    } else if (!/^\d+$/.test(room.roomNumber)) {
      errors['roomNumber'] = '房间号只能是数字'
    }
    
    // 费用标准验证
    if (!room.feeStandard.monthlyRent || isNaN(room.feeStandard.monthlyRent) || room.feeStandard.monthlyRent <= 0) {
      errors['feeStandard.monthlyRent'] = '请输入有效的月租金'
    }
    
    this.setData({ errors })
    return Object.keys(errors).length === 0
  },

  /**
   * 保存房间信息
   */
  async onSave() {
    if (!this.validateForm()) {
      wx.showToast({
        title: '请检查表单信息',
        icon: 'none'
      })
      return
    }
    
    try {
      this.setData({ saving: true })
      
      const { room, isEdit, roomId } = this.data
      
      const requestData = {
        action: isEdit ? 'update' : 'create',
        roomData: this.formatRoomData(room)
      }
      
      if (isEdit) {
        requestData.roomId = roomId
      }
      
      const response = await request.request({
        cloudFunc: 'room',
        data: requestData,
        url: isEdit ? `/api/rooms/${roomId}` : '/api/rooms',
        method: isEdit ? 'PUT' : 'POST'
      })
      
      if (response) {
        wx.showToast({
          title: isEdit ? '修改成功' : '添加成功',
          icon: 'success'
        })
        
        // 返回上一页并刷新列表
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    } catch (error) {
      console.error('保存房间信息失败:', error)
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    } finally {
      this.setData({ saving: false })
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
   * 选择器变化处理（简化）
   */
  onPickerChange(event) {
    const { field, options } = event.currentTarget.dataset
    const index = event.detail.value
    
    console.log('选择器变化:', field, index, options)
    
    // 特殊处理：楼栋选择
    if (field === 'buildingId') {
      const selectedBuilding = this.data.buildingList[index]
      if (selectedBuilding) {
        console.log('选择楼栋:', selectedBuilding)
        this.setData({
          selectedBuilding,
          'room.buildingId': selectedBuilding.id,
          'room.buildingName': selectedBuilding.name,
          showRoomSections: true,  // 显示房间信息区域
          editingBuilding: false   // 确保不在编辑状态
        })
      }
    } else {
      // 处理其他选择器
      const value = Array.isArray(options) ? options[index] : (options[index] ? options[index].value || options[index] : '')
      
      // 模拟事件对象调用onFieldChange
      this.onFieldChange({
        currentTarget: {
          dataset: { field }
        },
        detail: { value }
      })
    }
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation() {
    // 什么都不做，只是阻止事件冒泡
  },

  /**
   * 楼栋表单字段变化处理
   */
  onBuildingFieldChange(event) {
    const field = event.currentTarget.dataset.field
    const value = event.detail.value
    
    if (field) {
      // 直接更新buildingForm对象
      const newBuildingForm = { ...this.data.buildingForm }
      newBuildingForm[field] = value
      
      this.setData({
        buildingForm: newBuildingForm
      })
    }
  },

  /**
   * 楼栋管理 - 显示添加楼栋对话框
   */
  showAddBuildingDialog() {
    this.setData({
      showBuildingDialog: true,
      buildingForm: {
        id: '',
        name: '',
        address: '',
        floors: 4
      }
    })
  },

  /**
   * 楼栋管理 - 关闭对话框
   */
  closeBuildingDialog() {
    this.setData({
      showBuildingDialog: false
    })
  },

  /**
   * 楼栋管理 - 保存楼栋
   */
  async saveBuilding() {
    const { buildingForm } = this.data
    
    if (!buildingForm.name) {
      wx.showToast({
        title: '请输入楼栋名称',
        icon: 'none'
      })
      return
    }
    
    try {
      const response = await request.request({
        cloudFunc: 'building',
        data: {
          action: 'create',
          buildingData: buildingForm
        }
      })
      
      if (response && response.code === 200) {
        wx.showToast({
          title: '添加成功',
          icon: 'success'
        })
        
        this.closeBuildingDialog()
        await this.loadBuildingList()
        
        // 自动选择新添加的楼栋
        const newBuilding = response.data
        this.setData({
          'room.buildingId': newBuilding.id,
          'room.buildingName': newBuilding.name,
          selectedBuilding: newBuilding,
          showRoomSections: true
        })
      }
    } catch (error) {
      console.error('添加楼栋失败:', error)
      wx.showToast({
        title: '添加失败',
        icon: 'none'
      })
    }
  },

  /**
   * 开始编辑楼栋信息
   */
  startEditBuilding() {
    this.setData({
      editingBuilding: true,
      editingBuildingData: {
        ...this.data.selectedBuilding
      }
    })
  },

  /**
   * 取消编辑楼栋信息
   */
  cancelEditBuilding() {
    this.setData({
      editingBuilding: false,
      editingBuildingData: {}
    })
  },

  /**
   * 楼栋编辑字段变化处理
   */
  onEditBuildingFieldChange(event) {
    const field = event.currentTarget.dataset.field
    const value = event.detail.value
    
    if (field) {
      const newEditingData = { ...this.data.editingBuildingData }
      newEditingData[field] = value
      
      this.setData({
        editingBuildingData: newEditingData
      })
    }
  },

  /**
   * 保存楼栋编辑
   */
  async saveEditBuilding() {
    const { editingBuildingData } = this.data
    
    try {
      const response = await request.request({
        cloudFunc: 'building',
        data: {
          action: 'update',
          buildingId: editingBuildingData.id,
          ...editingBuildingData
        }
      })
      
      if (response && response.code === 200) {
        wx.showToast({
          title: '更新成功',
          icon: 'success'
        })
        
        // 更新选中的楼栋信息
        this.setData({
          selectedBuilding: editingBuildingData,
          editingBuilding: false,
          editingBuildingData: {}
        })
        
        // 重新加载楼栋列表
        await this.loadBuildingList()
      }
    } catch (error) {
      console.error('更新楼栋失败:', error)
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
    }
  },




  /**
   * 复制弹窗字段变化处理
   */
  onCopyFieldChange(event) {
    const field = event.currentTarget.dataset.field
    let value = event.detail ? event.detail.value : event.currentTarget.dataset.value
    
    if (field) {
      const fieldPath = field.split('.')
      let updateData = {}
      let current = updateData
      
      // 构建嵌套对象路径
      for (let i = 0; i < fieldPath.length - 1; i++) {
        current[fieldPath[i]] = current[fieldPath[i]] || {}
        current = current[fieldPath[i]]
      }
      current[fieldPath[fieldPath.length - 1]] = value
      
      this.setData(updateData)
    }
  },

  /**
   * 显示批量复制对话框
   */
  showCopyDialog() {
    if (!this.validateForm()) {
      wx.showToast({
        title: '请先完善房型信息',
        icon: 'none'
      })
      return
    }
    
    this.setData({
      showCopyDialog: true,
      copySettings: {
        copyCount: 1,
        multiFloor: false,
        generatedRooms: []
      }
    })
  },

  /**
   * 关闭批量复制对话框
   */
  closeCopyDialog() {
    this.setData({
      showCopyDialog: false
    })
  },

  /**
   * 生成批量房间列表
   */
  generateRoomList() {
    const { room, copySettings, selectedBuilding } = this.data
    const { copyCount, multiFloor } = copySettings
    const baseRoomNumber = parseInt(room.roomNumber)
    const generatedRooms = []
    
    if (!baseRoomNumber || copyCount < 1) {
      wx.showToast({
        title: '请输入有效的复制数量',
        icon: 'none'
      })
      return
    }
    
    if (multiFloor && selectedBuilding.floors) {
      // 多层生成
      const currentFloor = Math.floor(baseRoomNumber / 100)
      const roomSuffix = baseRoomNumber % 100
      
      for (let floor = currentFloor; floor <= selectedBuilding.floors; floor++) {
        for (let i = 0; i < copyCount; i++) {
          const newRoomNumber = floor * 100 + roomSuffix + i
          generatedRooms.push({
            ...room,
            roomNumber: newRoomNumber.toString(),
            floor: floor,
            id: `temp_${newRoomNumber}`
          })
        }
      }
    } else {
      // 单层生成
      for (let i = 1; i <= copyCount; i++) {
        const newRoomNumber = baseRoomNumber + i
        generatedRooms.push({
          ...room,
          roomNumber: newRoomNumber.toString(),
          floor: Math.floor(newRoomNumber / 100),
          id: `temp_${newRoomNumber}`
        })
      }
    }
    
    this.setData({
      'copySettings.generatedRooms': generatedRooms
    })
  },

  /**
   * 修改生成的房间信息
   */
  editGeneratedRoom(event) {
    const { index, field, value } = event.currentTarget.dataset
    const generatedRooms = [...this.data.copySettings.generatedRooms]
    
    if (generatedRooms[index]) {
      if (field.includes('.')) {
        const fieldPath = field.split('.')
        let current = generatedRooms[index]
        for (let i = 0; i < fieldPath.length - 1; i++) {
          current = current[fieldPath[i]]
        }
        current[fieldPath[fieldPath.length - 1]] = value
      } else {
        generatedRooms[index][field] = value
      }
      
      this.setData({
        'copySettings.generatedRooms': generatedRooms
      })
    }
  },

  /**
   * 批量保存房间
   */
  async batchSaveRooms() {
    const { room, copySettings } = this.data
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
      
      // 先保存原房间
      const originalResponse = await request.request({
        cloudFunc: 'room',
        data: {
          action: 'create',
          roomData: this.formatRoomData(room)
        }
      })
      
      // 批量保存复制的房间
      const batchResponse = await request.request({
        cloudFunc: 'room',
        data: {
          action: 'batchCreate',
          roomList: generatedRooms.map(r => this.formatRoomData(r))
        }
      })
      
      if (originalResponse && batchResponse) {
        wx.showToast({
          title: `成功创建${generatedRooms.length + 1}个房间`,
          icon: 'success'
        })
        
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    } catch (error) {
      console.error('批量保存房间失败:', error)
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    } finally {
      this.setData({ saving: false })
    }
  },

  /**
   * 取消编辑
   */
  onCancel() {
    wx.showModal({
      title: '提示',
      content: '确定要取消编辑吗？未保存的内容将丢失。',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack()
        }
      }
    })
  }
})