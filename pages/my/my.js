// pages/my/my.js
const app = getApp()

Page({
  data: {
    userInfo: {},
  },

  onLoad() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({
      userInfo
    });
  },

  onShow() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({
      userInfo
    });
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail; 
    wx.showLoading({
      title: '上传中',
    })
    // 将图片上传至云存储
    wx.cloud.uploadFile({
      cloudPath: `avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`, // 上传至云端的路径
      filePath: avatarUrl, // 小程序临时文件路径
      success: res => {
        // 返回文件 ID
        const userInfo = { ...this.data.userInfo, avatarUrl: res.fileID };
        this.setData({ userInfo });
        wx.setStorageSync('userInfo', userInfo);
        wx.hideLoading();
        wx.showToast({title: '更新成功', icon: 'success'});
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({title: '上传失败', icon: 'error'});
      }
    })
  },

  onNicknameBlur(e) {
    const nickName = e.detail.value;
    const userInfo = { ...this.data.userInfo, nickName };
    this.setData({ userInfo });
    wx.setStorageSync('userInfo', userInfo);
  },

  // 菜单跳转
  goToBills() {
    wx.navigateTo({ url: '/pages/bills/bills' });
  },

  goToMeterBatch() {
    wx.switchTab({ url: '/pages/meter-batch/meter-batch' });
  },

  goToAbout() {
    wx.showModal({
      title: '关于与帮助',
      content: '房租管理小程序，帮助房东管理房产、抄表和账单。',
      showCancel: false
    });
  },

  tapShare() {
    // 顶部右上角菜单可分享；此处给出提示
    wx.showToast({ title: '请使用右上角菜单分享', icon: 'none' });
  },

  onShareAppMessage() {
    return {
      title: '房租管理小程序',
      path: '/pages/index/index',
      imageUrl: '/images/share-image.png' // Optional: specify a custom share image
    }
  }
})
