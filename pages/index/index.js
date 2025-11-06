// pages/index/index.js
import request from '../../utils/request';

const app = getApp();

Page({
  data: {
    loading: false,
    monthlyStats: {
      totalBills: 0,
      paidBills: 0,
      unpaidBills: 0,
    },
  },

  onLoad(options) {
    this.loadStatistics();
  },

  onShow() {
    this.refreshStatistics();
  },

  onPullDownRefresh() {
    this.refreshStatistics();
  },

  async loadStatistics() {
    this.setData({ loading: true });
    try {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const response = await request.request({
        cloudFunc: 'bill',
        data: {
          action: 'getStatistics',
          startMonth: currentMonth,
          endMonth: currentMonth,
        },
      });

      if (response && response.code === 200) {
        const stats = response.data;
        this.setData({
          'monthlyStats.totalBills': stats.totalBills || 0,
          'monthlyStats.paidBills': stats.paidBills || 0,
          'monthlyStats.unpaidBills': stats.unpaidBills || 0,
        });
      }
    } catch (error) {
      console.error('加载账单统计失败:', error);
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  async refreshStatistics() {
    await this.loadStatistics();
  },

  goToRooms() {
    wx.navigateTo({
      url: '/pages/building-manage/building-manage',
    });
  },

  goToBills() {
    wx.navigateTo({
      url: '/pages/bills/bills',
    });
  },

  goToMeterReading() {
    wx.navigateTo({
      url: '/pages/meter-batch/meter-batch',
    });
  },
});
