// pages/meter/meter.js
Page({
  data: {},

  onLoad() {},

  // 跳转：批量抄表（沿用现有 meter-batch 页面）
  goToBatchMeter() {
    wx.navigateTo({ url: '/pages/meter-batch/meter-batch' });
  },

  // 跳转：退房抄表（跳转到已有退房登记页面）
  goToCheckoutRegister() {
    wx.navigateTo({ url: '/pages/checkout-register/checkout-register' });
  },
});
