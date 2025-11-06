import request from '../../utils/request';
import { dateUtils } from '../../utils/util';
import Toast from '../../miniprogram_npm/@vant/weapp/toast/toast';

Page({
  data: {
    selectedMonth: '',
    displayMonth: '',
    buildings: [],
    buildingIndex: 0,
    rooms: [],
    loading: false,
    activeTab: 'water', // 'water' or 'electricity'
    headerHeight: 0,
    // 新增：上期/本期最后抄表时间（整栋）
    previousLastTime: '',
    currentLastTime: '',
  },

  onReady: function() {
    this.measureHeader();
  },

onLoad: function (options) {
    this.initCurrentMonth();
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

  onMonthChange(e) {
    const selectedMonth = e.detail.value;
    const [year, month] = selectedMonth.split('-');
    const displayMonth = `${year}年${month}月`;
    
    this.setData({
      selectedMonth,
      displayMonth
    });
    
    if (this.data.buildings.length > 0) {
      this.loadRoomsForBuilding(this.data.buildings[this.data.buildingIndex].id);
    }
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

      const rooms = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

      // 计算整栋“最后抄表时间”（取各自月份的最大时间）
      let prevMax = 0;
      let currMax = 0;
      const roomsWithText = rooms.map(r => {
        // 规范化和格式化时间文本
        const prevTs = r.previousMeterTime ? new Date(r.previousMeterTime).getTime() : 0;
        const currTs = r.currentMeterTime ? new Date(r.currentMeterTime).getTime() : 0;
        const previousMeterTimeText = prevTs ? dateUtils.format(prevTs, 'YYYY-MM-DD HH:mm') : '';
        const currentMeterTimeText = currTs ? dateUtils.format(currTs, 'YYYY-MM-DD HH:mm') : '';

        // 汇总最大时间
        if (prevTs && !isNaN(prevTs)) prevMax = Math.max(prevMax, prevTs);
        if (currTs && !isNaN(currTs)) currMax = Math.max(currMax, currTs);

        return { ...r, previousMeterTimeText, currentMeterTimeText };
      });

      roomsWithText.forEach(r => {
        if (r.previousMeterTime) {
          const t = new Date(r.previousMeterTime).getTime();
          if (!isNaN(t)) prevMax = Math.max(prevMax, t);
        }
        if (r.currentMeterTime) {
          const t = new Date(r.currentMeterTime).getTime();
          if (!isNaN(t)) currMax = Math.max(currMax, t);
        }
      });

      const previousLastTime = prevMax ? dateUtils.format(prevMax, 'YYYY-MM-DD HH:mm') : '';
      const currentLastTime = currMax ? dateUtils.format(currMax, 'YYYY-MM-DD HH:mm') : '';

      this.setData({
        rooms: roomsWithText,
        previousLastTime,
        currentLastTime,
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

  async onSave() {
    const { rooms, selectedMonth } = this.data;
    if (!selectedMonth) {
      Toast.fail('请先选择月份');
      return;
    }

    const [year, month] = selectedMonth.split('-');

    // 支持单项（只填水或只填电）也可以保存
    const meterReadings = [];
    rooms.forEach(room => {
      const waterReading = parseFloat(room.currentMeterReading.water);
      const electricityReading = parseFloat(room.currentMeterReading.electricity);

      const payload = { roomId: room._id, year, month };
      if (!isNaN(waterReading)) payload.waterReading = waterReading;
      if (!isNaN(electricityReading)) payload.electricityReading = electricityReading;

      if (payload.waterReading !== undefined || payload.electricityReading !== undefined) {
        meterReadings.push(payload);
      }
    });

    if (meterReadings.length === 0) {
      Toast('没有需要保存的有效读数');
      return;
    }

    Toast.loading({ message: '保存中...', forbidClick: true, duration: 0 });

    try {
      await request.request({
        cloudFunc: 'meter',
        data: {
          action: 'batchRecord',
          meterReadings: meterReadings,
        }
      });

      Toast.success('保存成功');
      // Optionally, refresh the data
      this.loadRoomsForBuilding(this.data.buildings[this.data.buildingIndex].id);

    } catch (error) {
      console.error('批量保存抄表数据失败:', error);
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
