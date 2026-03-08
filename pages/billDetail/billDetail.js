// pages/billDetail/billDetail.js
import request from '../../utils/request';

Page({
  data: {
    billDetail: null,
    loading: true,
    billId: ''
  },

  onLoad(options) {
    if (options.billId) {
      this.setData({
        billId: options.billId
      });
      this.loadBillDetail();
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

  // 加载账单详情
  async loadBillDetail() {
    try {
      this.setData({ loading: true });
      
      const res = await request.request({
        cloudFunc: 'bill',
        data: {
          action: 'detail',
          billId: this.data.billId
        }
      });

      if (res) {
        this.setData({
          billDetail: res,
          loading: false
        });
      } else {
        throw new Error('获取账单详情失败');
      }
    } catch (error) {
      console.error('加载账单详情失败:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      });
    }
  },

  // 标记收款
  async markBillPaid() {
    const { billDetail } = this.data;
    
    if (!billDetail) return;
    
    if (billDetail.status === 2) {
      wx.showToast({
        title: '该账单已收款',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认收款',
      content: `确认标记账单为已收款？\n金额：¥${billDetail.totalAmount}`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });
            
            const result = await request.request({
              cloudFunc: 'bill',
              data: {
                action: 'markPaid',
                billId: this.data.billId,
                paidAmount: billDetail.totalAmount
              }
            });

            if (result) {
              wx.showToast({
                title: '标记成功',
                icon: 'success'
              });
              
              // 重新加载数据
              this.loadBillDetail();
            } else {
              throw new Error('标记失败');
            }
          } catch (error) {
            console.error('标记收款失败:', error);
            wx.showToast({
              title: error.message || '标记失败',
              icon: 'none'
            });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },

  // 分享账单
  async shareBill() {
    const { billDetail } = this.data;
    if (!billDetail) return;

    wx.showLoading({ title: '生成账单中...' });

    try {
      const canvasData = await this.createBillCanvas();
      wx.hideLoading();

      wx.showShareImageMenu({
        path: canvasData.tempFilePath,
        success: () => {
          console.log('拉起转发成功');
        },
        fail: (err) => {
          console.error('拉起转发失败', err);
          wx.showToast({
            title: '无法分享',
            icon: 'none'
          });
        }
      });
    } catch (error) {
      wx.hideLoading();
      console.error('生成账单图片失败:', error);
      wx.showToast({
        title: '生成图片失败',
        icon: 'none'
      });
    }
  },

  // 创建账单Canvas
  createBillCanvas() {
    return new Promise((resolve, reject) => {
      const { billDetail } = this.data;
      
      const canvas = wx.createCanvasContext('billCanvas', this);
      const canvasWidth = 375;
      const canvasHeight = 600;
      
      // 设置背景色
      canvas.setFillStyle('#ffffff');
      canvas.fillRect(0, 0, canvasWidth, canvasHeight);
      
      // 绘制标题
      canvas.setFontSize(20);
      canvas.setFillStyle('#323233');
      canvas.setTextAlign('center');
      canvas.fillText('房租账单', canvasWidth / 2, 40);
      
      // 绘制房间信息
      canvas.setFontSize(16);
      canvas.setTextAlign('left');
      canvas.fillText(`房间：${billDetail.buildingName} ${billDetail.roomNumber}`, 20, 80);
      canvas.fillText(`租客：${billDetail.tenantName || '未设置'}`, 20, 110);
      canvas.fillText(`账单月份：${billDetail.billMonth}`, 20, 140);
      
      // 绘制费用明细
      let y = 180;
      canvas.setFontSize(14);
      canvas.fillText('费用明细：', 20, y);
      
      y += 30;
      canvas.fillText(`房租：¥${billDetail.rentAmount}`, 30, y);
      
      y += 25;
      canvas.fillText(`水费：¥${billDetail.waterAmount} (${billDetail.waterUsage}吨, ${billDetail.waterPrice}元/吨)`, 30, y);
      
      y += 25;
      canvas.fillText(`电费：¥${billDetail.electricityAmount} (${billDetail.electricityUsage}度, ${billDetail.electricityPrice}元/度)`, 30, y);
      
      if (billDetail.cleaningAmount > 0) {
        y += 25;
        canvas.fillText(`卫生费/清洁费：¥${billDetail.cleaningAmount}`, 30, y);
      }
      if (billDetail.managementFee > 0) {
        y += 25;
        canvas.fillText(`管理费：¥${billDetail.managementFee}`, 30, y);
      }
      if (billDetail.internetFee > 0) {
        y += 25;
        canvas.fillText(`网费：¥${billDetail.internetFee}`, 30, y);
      }
      if (billDetail.otherFee > 0) {
        y += 25;
        canvas.fillText(`其他费用：¥${billDetail.otherFee}`, 30, y);
      }
      
      // 绘制总金额
      y += 50;
      canvas.setFontSize(18);
      canvas.setFillStyle('#ff6b35');
      canvas.fillText(`总金额：¥${billDetail.totalAmount}`, 20, y);
      
      // 绘制状态
      y += 40;
      canvas.setFontSize(14);
      canvas.setFillStyle(billDetail.status === 2 ? '#07c160' : '#ff976a');
      canvas.fillText(`状态：${billDetail.statusText}`, 20, y);
      
      // 绘制日期
      y += 30;
      canvas.setFontSize(12);
      canvas.setFillStyle('#969799');
      const createDate = new Date(billDetail.createdAt).toLocaleDateString();
      canvas.fillText(`创建日期：${createDate}`, 20, y);
      
      canvas.draw(true, () => {
        // 导出图片
        wx.canvasToTempFilePath({
          canvasId: 'billCanvas',
          success: resolve,
          fail: reject
        }, this);
      });
    });
  },

  // 保存账单图片
  async saveBillImage() {
    wx.showLoading({ title: '生成中...' });
    try {
      const canvasData = await this.createBillCanvas();
      wx.saveImageToPhotosAlbum({
        filePath: canvasData.tempFilePath,
        success: () => {
          wx.showToast({ title: '已保存到相册', icon: 'success' });
        },
        fail: () => {
          wx.showToast({ title: '保存失败，请检查权限', icon: 'none' });
        }
      });
    } catch (error) {
      wx.showToast({ title: '生成图片失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadBillDetail().finally(() => {
      wx.stopPullDownRefresh();
    });
  }
});
