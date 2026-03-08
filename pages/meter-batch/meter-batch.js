import request from '../../utils/request';
import { dateUtils } from '../../utils/util';
import Toast from '../../miniprogram_npm/@vant/weapp/toast/toast';

Page({
  data: {
    currentMonth: '',
    currentMonthDisplay: '',
    buildings: [],
    buildingIndex: 0,
    rooms: [],
    loading: false,
    activeTab: 'water', // 'water' or 'electricity'
    headerHeight: 0
  },

  onReady: function() {
    this.measureHeader();
  },

  onLoad: function () {
    this.setCurrentMonth();
    this.loadBuildingList();
  },

  onShow() {
    if (this.data.buildings.length > 0 && this.data.buildings[this.data.buildingIndex]) {
        this.loadRoomsForBuilding(this.data.buildings[this.data.buildingIndex].id);
    }
    // 重新测量，避免开发者工具首次渲染获取高度为0
    this.measureHeader();
  },

  measureHeader() {
    wx.nextTick(() => {
      const query = wx.createSelectorQuery();
      query.select('#header-fixed').boundingClientRect(rect => {
        if (rect && rect.height) {
          this.setData({ headerHeight: rect.height });
        } else if (!this.data.headerHeight) {
          // 兜底高度，避免为0导致 sticky 覆盖
          this.setData({ headerHeight: 80 });
        }
      }).exec();
    });
  },

  setCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    this.setData({
      currentMonth: `${year}-${month}`,
      currentMonthDisplay: `${year}年${month}月`
    });
  },

  ensureCurrentMonth() {
    if (!this.data.currentMonth) {
      this.setCurrentMonth();
    }
    return this.data.currentMonth;
  },

  getPreviousMonth(monthStr) {
    const [year, month] = monthStr.split('-').map(n => parseInt(n, 10));
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  },

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
      Toast.fail('加载楼栋失败');
      this.setData({ loading: false });
    }
  },

  async loadRoomsForBuilding(buildingId) {
    try {
      this.setData({ loading: true });
      
      const currentMonth = this.ensureCurrentMonth();
      const [year, month] = currentMonth.split('-');
      const previousMonth = this.getPreviousMonth(currentMonth);

      const res = await request.request({
        cloudFunc: 'meter',
        data: {
          action: 'getRoomsForBatchMeter',
          buildingId: buildingId,
          currentMonth: currentMonth,
          previousMonth: previousMonth
        }
      });

      const rooms = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

      const roomsWithText = rooms.map(r => {
        const lastMeterReading = r.lastMeterReading || {};
        const prevWaterTs = r.previousMeterTime?.water ? new Date(r.previousMeterTime.water).getTime() : 0;
        const prevElectricityTs = r.previousMeterTime?.electricity ? new Date(r.previousMeterTime.electricity).getTime() : 0;
        
        const unbilledWater = r.currentMeterReading?.water;
        const unbilledElectricity = r.currentMeterReading?.electricity;

        return {
          ...r,
          lastMeterReading: {
            water: lastMeterReading.water ?? '--',
            electricity: lastMeterReading.electricity ?? '--'
          },
          previousMeterTimeTextWater: prevWaterTs ? dateUtils.format(prevWaterTs, 'YYYY-MM-DD HH:mm') : '',
          previousMeterTimeTextElectricity: prevElectricityTs ? dateUtils.format(prevElectricityTs, 'YYYY-MM-DD HH:mm') : '',
          currentMeterReading: {
            water: unbilledWater !== undefined && unbilledWater !== '' ? String(unbilledWater) : '',
            electricity: unbilledElectricity !== undefined && unbilledElectricity !== '' ? String(unbilledElectricity) : ''
          },
          // 标记是否存在未开单数据以及是否允许编辑
          unbilled: {
            water: unbilledWater !== undefined && unbilledWater !== '' ? String(unbilledWater) : '',
            electricity: unbilledElectricity !== undefined && unbilledElectricity !== '' ? String(unbilledElectricity) : ''
          },
          canEdit: {
            water: !(unbilledWater !== undefined && unbilledWater !== ''),
            electricity: !(unbilledElectricity !== undefined && unbilledElectricity !== '')
          }
        };
      });

      this.setData({
        rooms: roomsWithText
      });

    } catch (error) {
      console.error('加载房间列表失败:', error);
      Toast.fail('加载房间失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  onBuildingChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({ buildingIndex: index });
    this.loadRoomsForBuilding(this.data.buildings[index].id);
  },

  onTabChange(event) {
    this.setData({ activeTab: event.detail.name });
  },

  onInput(e) {
    const { roomId, field } = e.currentTarget.dataset;
    const value = e.detail;
    const roomIndex = this.data.rooms.findIndex(r => r._id === roomId);

    if (roomIndex === -1) return;

    this.setData({
      [`rooms[${roomIndex}].currentMeterReading.${field}`]: value
    });
  },

  onFieldClick(e) {
    const { roomId, field } = e.currentTarget.dataset;
    const roomIndex = this.data.rooms.findIndex(r => r._id === roomId);

    if (roomIndex === -1) return;

    const room = this.data.rooms[roomIndex];
    if (!room.canEdit[field]) {
      const unbilledValue = room.unbilled[field];
      wx.showModal({
        title: '提示',
        content: `已存在未开单读数 ${unbilledValue}，是否更新？`,
        success: (res) => {
          if (res.confirm) {
            this.setData({
              [`rooms[${roomIndex}].canEdit.${field}`]: true
            });
          }
        }
      });
    }
  },

  async onSave() {
    const { rooms, activeTab } = this.data;
    const currentMonth = this.ensureCurrentMonth();
    const [year, month] = currentMonth.split('-');

    const meterReadings = [];
    let hasError = false;
    let errorMessage = '';

    if (activeTab === 'water') {
      for (const room of rooms) {
        const strVal = room.currentMeterReading.water;
        if (strVal === undefined || strVal === '') continue;
        
        const waterReading = parseFloat(strVal);
        const lastWater = parseFloat(room.lastMeterReading.water) || 0;
        
        if (!isNaN(waterReading)) {
          if (waterReading < lastWater) {
            hasError = true;
            errorMessage = `${room.roomName}水表不能小于上期(${lastWater})`;
            break;
          }
          meterReadings.push({
            roomId: room._id,
            year,
            month,
            meterType: 'water',
            waterReading: waterReading
          });
        }
      }
      if (hasError) {
        Toast(errorMessage);
        return;
      }
      if (meterReadings.length === 0) {
        Toast('没有需要保存的水表读数');
        return;
      }
    } else {
      for (const room of rooms) {
        const strVal = room.currentMeterReading.electricity;
        if (strVal === undefined || strVal === '') continue;
        
        const electricityReading = parseFloat(strVal);
        const lastElectricity = parseFloat(room.lastMeterReading.electricity) || 0;
        
        if (!isNaN(electricityReading)) {
          if (electricityReading < lastElectricity) {
            hasError = true;
            errorMessage = `${room.roomName}电表不能小于上期(${lastElectricity})`;
            break;
          }
          meterReadings.push({
            roomId: room._id,
            year,
            month,
            meterType: 'electricity',
            electricityReading: electricityReading
          });
        }
      }
      if (hasError) {
        Toast(errorMessage);
        return;
      }
      if (meterReadings.length === 0) {
        Toast('没有需要保存的电表读数');
        return;
      }
    }

    wx.showLoading({ title: '保存中...', mask: true });

    try {
      await request.request({
        cloudFunc: 'meter',
        data: {
          action: 'batchRecord',
          meterReadings: meterReadings,
        }
      });

      wx.hideLoading();
      Toast.success('保存成功');
      // Optionally, refresh the data
      this.loadRoomsForBuilding(this.data.buildings[this.data.buildingIndex].id);

    } catch (error) {
      console.error('批量保存抄表数据失败:', error);
      wx.hideLoading();
      Toast.fail('保存失败');
    }
  },

  onViewBills() {
    wx.navigateTo({ url: '/pages/bills/bills' });
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
