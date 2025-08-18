// pages/meter-batch/meter-batch.js
import request from '../../utils/request';

Page({
  data: {
    selectedMonth: '',
    displayMonth: '',
    buildings: [],
    buildingIndex: 0,
    rooms: [],
    loading: false,
    meterReadings: {}, // 用于存储临时的抄表数据
    submittingRooms: [], // 正在提交的房间ID数组
  },

  onLoad: function (options) {
    this.initCurrentMonth();
    this.loadBuildingList();
  },

  onShow() {
    // onShow is a good place to refresh data if needed
    if (this.data.buildings.length > 0 && this.data.buildings[this.data.buildingIndex]) {
        this.loadRoomsForBuilding(this.data.buildings[this.data.buildingIndex].id);
    }
  },

  // 初始化当前月份
  initCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const selectedMonth = `${year}-${month}`;
    const displayMonth = `${year}年${month}月`;
    
    this.setData({
      selectedMonth,
      displayMonth
    });
  },

  // 月份选择器变化
  onMonthChange(e) {
    const selectedMonth = e.detail.value;
    const [year, month] = selectedMonth.split('-');
    const displayMonth = `${year}年${month}月`;
    
    this.setData({
      selectedMonth,
      displayMonth
    });
    
    // 重新加载房间数据
    if (this.data.buildings.length > 0) {
      this.loadRoomsForBuilding(this.data.buildings[this.data.buildingIndex].id);
    }
  },

  // 加载楼栋列表
  async loadBuildingList() {
    try {
      this.setData({ loading: true });
      
      const res = await request.request({
        cloudFunc: 'building',
        data: { action: 'list' }
      });

      const buildings = res.list || [];
      
      buildings.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      this.setData({ 
        buildings: buildings,
        buildingIndex: 0
      });
      
      if (buildings.length > 0) {
        this.loadRoomsForBuilding(buildings[0].id);
      } else {
        this.setData({ rooms: [], loading: false });
      }
    } catch (error) {
      console.error('加载楼栋列表失败:', error);
      wx.showToast({ title: '加载楼栋失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  // [重构] 根据楼栋ID加载房间列表
  async loadRoomsForBuilding(buildingId) {
    try {
      this.setData({ loading: true });
      
      const { selectedMonth } = this.data;
      const [year, month] = selectedMonth.split('-');
      
      const currentDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const previousDate = new Date(new Date(currentDate).setMonth(currentDate.getMonth() - 1));
      const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;

      const res = await request.request({
        cloudFunc: 'meter',
        data: {
          action: 'getRoomsForBatchMeter',
          buildingId: buildingId,
          currentMonth: selectedMonth,
          previousMonth: previousMonth
        }
      });

      const rooms = res || [];
      
      const meterReadings = {};
      rooms.forEach(room => {
        // Pre-initialize meterReadings for all rooms to avoid binding errors
        meterReadings[room._id] = {
          water: '',
          electricity: ''
        };
        if (room.isMetered && room.currentMeterReading) {
          meterReadings[room._id] = {
            water: room.currentMeterReading.water.toString(),
            electricity: room.currentMeterReading.electricity.toString()
          };
        }
      });
      
      this.setData({ 
        rooms: rooms,
        meterReadings: meterReadings,
        submittingRooms: []
      });

    } catch (error) {
      console.error('加载房间列表失败:', error);
      wx.showToast({ title: '加载房间失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 楼栋选择器变化
  onBuildingChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({ buildingIndex: index });
    this.loadRoomsForBuilding(this.data.buildings[index].id);
  },

  onInputChange(e) {
    const { roomId, field } = e.currentTarget.dataset;
    const value = e.detail.value;
    this.setData({
      [`meterReadings.${roomId}.${field}`]: value
    });
  },

  onInputBlur(e) {
    const { roomId } = e.currentTarget.dataset;
    const roomReading = this.data.meterReadings[roomId];
    const room = this.data.rooms.find(r => r._id === roomId);

    if (room && !room.isMetered && !this.data.submittingRooms.includes(roomId) &&
        roomReading && roomReading.electricity && roomReading.water && 
        roomReading.electricity.trim() && roomReading.water.trim()) {
      
      setTimeout(() => {
        this.submitMeterReading(roomId);
      }, 200);
    }
  },

  async submitMeterReading(roomId) {
    if (this.data.submittingRooms.includes(roomId)) return;

    const room = this.data.rooms.find(r => r._id === roomId);
    const reading = this.data.meterReadings[roomId];
    
    if (!room || !reading) return;

    const electricityReading = parseFloat(reading.electricity);
    const waterReading = parseFloat(reading.water);
    
    if (isNaN(electricityReading) || isNaN(waterReading) || electricityReading < 0 || waterReading < 0) {
      wx.showToast({ title: '请输入有效的表读数', icon: 'none' });
      return;
    }

    this.setData({ submittingRooms: [...this.data.submittingRooms, roomId] });

    try {
      const { selectedMonth } = this.data;
      const [year, month] = selectedMonth.split('-');
      
      const res = await request.request({
        cloudFunc: 'meter',
        data: {
          action: 'submitMeterReading',
          roomId: roomId,
          year: year,
          month: month,
          electricityReading: electricityReading,
          waterReading: waterReading,
        }
      });

      if (res) {
        const { waterUsage, electricityUsage, billGenerated, totalAmount } = res;
        
        this.updateRoomData(roomId, {
          isMetered: true,
          waterUsage: waterUsage,
          electricityUsage: electricityUsage,
          generatedBillId: res.billId
        });
        
        let message = `${room.roomName}室抄表完成`;
        if (billGenerated && totalAmount) {
          message += ` ¥${totalAmount.toFixed(2)}`;
        }
        
        wx.showToast({ title: message, icon: 'success', duration: 1500 });
      } else {
        throw new Error('抄表响应数据为空');
      }
      
    } catch (error) {
      console.error(`提交抄表数据失败 for room ${roomId}:`, error);
      wx.showToast({ title: `${room.roomName}室保存失败`, icon: 'error', duration: 1500 });
    } finally {
      this.setData({ submittingRooms: this.data.submittingRooms.filter(id => id !== roomId) });
    }
  },

  updateRoomData(roomId, newData) {
    const roomIndex = this.data.rooms.findIndex(r => r._id === roomId);
    if (roomIndex > -1) {
      this.setData({
        [`rooms[${roomIndex}]`]: { ...this.data.rooms[roomIndex], ...newData }
      });
    }
  },

  onPullDownRefresh() {
    if (this.data.buildings.length > 0) {
      this.loadRoomsForBuilding(this.data.buildings[this.data.buildingIndex].id).finally(() => {
        wx.stopPullDownRefresh();
      });
    } else {
      this.loadBuildingList().finally(() => {
        wx.stopPullDownRefresh();
      });
    }
  }
});