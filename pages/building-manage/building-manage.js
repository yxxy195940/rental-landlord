// pages/building-manage/building-manage.js
import request from '../../utils/request';

Page({
  data: {
    buildings: [],
    deleteMode: false,
    selectedBuildings: [],
    showDialog: false,
    dialogTitle: '',
    buildingForm: {
      id: null,
      name: '',
      address: '',
      floors: '',
    },
  },

  onLoad: function () {
    this.loadBuildings();
  },

  async loadBuildings() {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await request.request({
        cloudFunc: 'building',
        data: { action: 'list' },
      });
      this.setData({ buildings: res.list || [] });
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onAddBuilding: function () {
    this.setData({
      showDialog: true,
      dialogTitle: '添加楼栋',
      buildingForm: { id: null, name: '', address: '', floors: '' },
    });
  },

  onEditBuilding: function (e) {
    const { id } = e.currentTarget.dataset;
    const building = this.data.buildings.find(b => b.id === id);
    if (building) {
      this.setData({
        showDialog: true,
        dialogTitle: '编辑楼栋',
        buildingForm: { ...building },
      });
    }
  },

  onDeleteBuilding: function () {
    this.setData({ deleteMode: true, selectedBuildings: [] });
  },

  onCancelDelete: function () {
    const buildings = this.data.buildings.map(b => ({ ...b, checked: false }));
    this.setData({ deleteMode: false, selectedBuildings: [], buildings });
  },

  onConfirmDelete: async function () {
    const { selectedBuildings } = this.data;
    if (selectedBuildings.length === 0) {
      wx.showToast({ title: '请选择楼栋', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: `删除楼栋将同时删除其下所有房间，确定要删除选中的 ${selectedBuildings.length} 个楼栋吗？`,
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          try {
            await request.request({
              cloudFunc: 'building',
              data: { action: 'delete', buildingIds: selectedBuildings },
            });
            wx.hideLoading();
            wx.showToast({ title: '删除成功' });
            this.setData({ deleteMode: false, selectedBuildings: [] });
            this.loadBuildings();
          } catch (error) {
            wx.hideLoading();
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      },
    });
  },

  onCheckboxChange: function (e) {
    const { id } = e.currentTarget.dataset;
    const { buildings, selectedBuildings } = this.data;
    
    const building = buildings.find(b => b.id === id);
    if (building) {
      building.checked = !building.checked;
      if (building.checked) {
        selectedBuildings.push(id);
      } else {
        const index = selectedBuildings.indexOf(id);
        if (index > -1) {
          selectedBuildings.splice(index, 1);
        }
      }
      this.setData({ buildings, selectedBuildings });
    }
  },

  onDialogClose: function () {
    this.setData({ showDialog: false });
  },

  onFormInput: function (e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`buildingForm.${field}`]: e.detail,
    });
  },

  onDialogConfirm: async function () {
    const { buildingForm } = this.data;
    if (!buildingForm.name) {
      wx.showToast({ title: '请输入楼栋名称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });
    try {
      const action = buildingForm.id ? 'update' : 'create';
      await request.request({
        cloudFunc: 'building',
        data: { action, buildingId: buildingForm.id, buildingData: buildingForm },
      });
      wx.hideLoading();
      this.setData({ showDialog: false });
      
      wx.showModal({
        title: '成功',
        content: '保存成功！前往房间管理？',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/rooms/rooms',
            });
          } else {
            this.loadBuildings();
          }
        }
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },
});
