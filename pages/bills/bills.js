// pages/bills/bills.js
import request from '../../utils/request';
const storage = require('../../utils/storage').default;

Page({
  data: {
    selectedMonth: '',
    displayMonth: '',
    currentBuilding: {},
    buildingList: [],
    selectedBuildingIndex: 0,
    searchKeyword: '',
    billList: [],
    filteredBillList: [],
    loading: false,
    page: 1,
    hasMore: true
  },

  onLoad(options) {
    // 检查是否从抄表页面跳转过来，带有特定参数
    if (options.buildingId && options.billMonth) {
      const [year, month] = options.billMonth.split('-');
      const displayMonth = `${year}年${month}月`;
      
      this.setData({
        selectedMonth: options.billMonth,
        displayMonth: displayMonth,
        fromMeterPage: true,
        targetBuildingId: options.buildingId
      });
    } else {
      this.initCurrentMonth();
    }
    
    this.loadBuildingList();
  },

  onShow() {
    // 检查当前楼栋是否存在，如果不存在则重新加载
    if (!this.data.currentBuilding.id) {
      this.loadCurrentBuilding();
    } else {
      this.loadBillList();
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
    
    // 重新加载当月账单
    this.loadBillList();
  },

  // 加载楼栋列表
  async loadBuildingList() {
    try {
      const res = await request.request({
        cloudFunc: 'building',
        data: { action: 'list' }
      });

      const buildings = res.list || [];
      
      // 按更新时间降序排序，最新的在最前面
      buildings.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      this.setData({ 
        buildingList: buildings 
      });
      
      // 如果没有当前楼栋，设置第一个为默认楼栋
      if (buildings.length > 0 && !this.data.currentBuilding.id) {
        // 如果是从抄表页面跳转过来，优先选择指定的楼栋
        let targetBuilding = buildings[0];
        let targetIndex = 0;
        
        if (this.data.fromMeterPage && this.data.targetBuildingId) {
          const targetIdx = buildings.findIndex(b => b.id === this.data.targetBuildingId);
          if (targetIdx >= 0) {
            targetBuilding = buildings[targetIdx];
            targetIndex = targetIdx;
          }
        }
        
        this.setData({
          currentBuilding: targetBuilding,
          selectedBuildingIndex: targetIndex
        });
        this.loadBillList();
      }
    } catch (error) {
      console.error('加载楼栋列表失败:', error);
      wx.showToast({
        title: '加载楼栋失败',
        icon: 'none'
      });
    }
  },

  // 加载当前楼栋
  loadCurrentBuilding() {
    const currentBuilding = storage.get('currentBuilding');
    if (currentBuilding) {
      // 查找当前楼栋在列表中的索引
      const index = this.data.buildingList.findIndex(building => building.id === currentBuilding.id);
      this.setData({ 
        currentBuilding,
        selectedBuildingIndex: index >= 0 ? index : 0
      });
      this.loadBillList();
    } else {
      this.loadBuildingList();
    }
  },

  // 加载账单列表
  async loadBillList(reset = true) {
    if (!this.data.currentBuilding.id) {
      return;
    }

    if (reset) {
      this.setData({
        page: 1,
        hasMore: true,
        billList: [],
        loading: true
      });
    }

    try {
      const { selectedMonth, currentBuilding, page, searchKeyword } = this.data;
      const [year, month] = selectedMonth.split('-');
      const billMonth = `${year}-${month.padStart(2, '0')}`;
      
      // 调用账单云函数获取数据
      const res = await request.request({
        cloudFunc: 'bill',
        data: {
          action: 'list',
          buildingId: currentBuilding.id,
          billMonth: billMonth,
          keyword: searchKeyword,
          page: page,
          pageSize: 20
        }
      });

      const bills = res.list || [];
      
      // 转换数据格式以兼容现有UI
      const transformedBills = bills.map(bill => ({
        id: bill.id,
        roomNumber: bill.roomNumber,
        roomId: bill.roomId,
        rent: bill.rentAmount,
        waterFee: bill.waterAmount,
        electricFee: bill.electricityAmount,
        totalAmount: bill.totalAmount,
        isPaid: bill.status === 2,
        status: bill.status,
        statusText: bill.statusText,
        billDate: bill.billMonth + '-01',
        dueDate: bill.billMonth + '-25',
        tenantName: bill.tenantName,
        tenantPhone: bill.tenantPhone,
        waterUsage: bill.waterUsage,
        electricityUsage: bill.electricityUsage,
        paidAmount: bill.paidAmount,
        paidAt: bill.paidAt,
        createTime: bill.createdAt
      }));
      
      this.setData({
        billList: reset ? transformedBills : [...this.data.billList, ...transformedBills],
        hasMore: res.hasMore || false,
        loading: false
      });

      this.filterBillList();
    } catch (error) {
      console.error('加载账单列表失败:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载账单失败',
        icon: 'none'
      });
    }
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
    this.filterBillList();
  },

  // 搜索确认
  onSearchConfirm() {
    this.filterBillList();
  },

  // 过滤账单列表
  filterBillList() {
    const { billList, searchKeyword } = this.data;
    let filteredBillList = billList;

    if (searchKeyword.trim()) {
      filteredBillList = billList.filter(bill => 
        bill.roomNumber.includes(searchKeyword.trim())
      );
    }

    this.setData({
      filteredBillList
    });
  },

  // 楼栋选择器变化
  onBuildingChange(e) {
    const index = parseInt(e.detail.value);
    const building = this.data.buildingList[index];
    
    this.setData({
      selectedBuildingIndex: index,
      currentBuilding: building
    });
    
    // 保存当前楼栋到缓存
    storage.set('currentBuilding', building);
    
    // 重新加载账单列表
    this.loadBillList();
  },

  // 阻止冒泡
  stopPropagation() {
    // 阻止事件冒泡
  },

  // 跳转到账单详情
  gotoBillDetail(e) {
    const bill = e.currentTarget.dataset.bill;
    wx.navigateTo({
      url: `/pages/billDetail/billDetail?billId=${bill.id}`
    });
  },

  // 标记单个账单为已收款
  async markBillPaid(e) {
    e.stopPropagation();
    const bill = e.currentTarget.dataset.bill;
    
    if (bill.status === 2) {
      wx.showToast({
        title: '该账单已收款',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认收款',
      content: `确认标记房间${bill.roomNumber}的账单为已收款？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });
            
            const result = await request.request({
              cloudFunc: 'bill',
              data: {
                action: 'markPaid',
                billId: bill.id,
                paidAmount: bill.totalAmount
              }
            });

            if (result.code === 200) {
              wx.showToast({
                title: '标记成功',
                icon: 'success'
              });
              
              // 重新加载数据
              this.loadBillList();
            } else {
              throw new Error(result.message);
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

  // 批量标记收款
  async batchMarkPaid() {
    const unpaidBills = this.data.filteredBillList.filter(bill => bill.status !== 2);
    
    if (unpaidBills.length === 0) {
      wx.showToast({
        title: '没有待收款账单',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '批量收款确认',
      content: `确认将${unpaidBills.length}个未收款账单标记为已收款？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '批量处理中...' });
            
            const billIds = unpaidBills.map(bill => bill.id);
            const result = await request.request({
              cloudFunc: 'bill',
              data: {
                action: 'batchMarkPaid',
                billIds: billIds
              }
            });

            if (result.code === 200) {
              wx.showToast({
                title: `成功标记${result.successCount}条`,
                icon: 'success'
              });
              
              // 重新加载数据
              this.loadBillList();
            } else {
              throw new Error(result.message);
            }
          } catch (error) {
            console.error('批量标记失败:', error);
            wx.showToast({
              title: error.message || '批量标记失败',
              icon: 'none'
            });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },

  // 加载更多账单
  loadMoreBills() {
    if (!this.data.hasMore || this.data.loading) {
      return;
    }

    this.setData({
      page: this.data.page + 1
    });
    
    this.loadBillList(false);
  },

  // 下拉刷新（已禁用，保留空实现防御）
  onPullDownRefresh() { try { wx.stopPullDownRefresh(); } catch (e) {} }
})
