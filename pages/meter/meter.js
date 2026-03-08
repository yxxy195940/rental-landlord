Page({
  data: {},

  onLoad() {},

  goToBatchMeter() {
    wx.navigateTo({ url: '/pages/meter-batch/meter-batch' })
  },

  goToMeterHistory() {
    wx.navigateTo({ url: '/pages/meter-history/meter-history' })
  }
})
