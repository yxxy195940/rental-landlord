import request from '../../utils/request';

Page({
  data: {
    billDetail: null,
    loading: true,
    roomId: '',
    billMonth: ''
  },

  onLoad(options) {
    if (options.roomId && options.billMonth) {
      this.setData({
        roomId: options.roomId,
        billMonth: options.billMonth
      });
    } else {
      wx.showToast({
        title: '缺少账单参数',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  onShow() {
    if (this.data.roomId && this.data.billMonth) {
      this.previewBill();
    }
  },

  // 预览账单详情
  async previewBill() {
    try {
      this.setData({ loading: true });
      
      const res = await request.request({
        cloudFunc: 'bill',
        data: {
          action: 'preview',
          roomId: this.data.roomId,
          billMonth: this.data.billMonth
        }
      });

      if (res) {
        this.setData({
          billDetail: res,
          loading: false
        });
      } else {
        throw new Error('获取账单预览失败');
      }
    } catch (error) {
      console.error('预览账单失败:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      });
    }
  },

  // 修改房间费用
  editRoomFee() {
    if (!this.data.roomId) return;
    wx.navigateTo({
      url: `/pages/room-edit/room-edit?roomId=${this.data.roomId}`
    });
  },

  // 确认开单
  async confirmCreateBill() {
    try {
      wx.showLoading({ title: '开单中...' });
      
      const { billDetail } = this.data;
      const res = await request.request({
        cloudFunc: 'bill',
        data: {
          action: 'create',
          billData: billDetail
        }
      });

      if (res && res.id) {
        wx.showToast({ title: '开单成功', icon: 'success' });
        // 开单成功后，可以直接返回，因为列表页会在onShow时刷新
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        throw new Error('开单失败');
      }
    } catch (error) {
      console.error('开单失败:', error);
      wx.showToast({
        title: error.message || '操作失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  }
});
