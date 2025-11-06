// pages/rooms/rooms.js
import request from '../../utils/request';

Page({
  data: {
    buildings: [],
    buildingIndex: 0,
    rooms: [],
    filteredRooms: [],
    searchKeyword: '',
    deleteMode: false,
    selectedRooms: [],
  },

  onShow: function () {
    this.loadBuildingsAndRooms();
  },

  async loadBuildingsAndRooms() {
    wx.showLoading({ title: '加载中...' });
    try {
      const buildingRes = await request.request({ cloudFunc: 'building', data: { action: 'list' } });
      let buildings = buildingRes.list || [];

      if (buildings.length === 0) {
        // If no buildings, create a default one
        await request.request({ 
          cloudFunc: 'building', 
          data: { action: 'create', buildingData: { name: '楼栋A' } } 
        });
        const newBuildingRes = await request.request({ cloudFunc: 'building', data: { action: 'list' } });
        buildings = newBuildingRes.list || [];
      }
      
      buildings.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      this.setData({ buildings, buildingIndex: 0 });

      if (buildings.length > 0) {
        await this.loadRoomsByBuilding(buildings[0].id);
      }
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      console.error("Error loading data:", error);
    } finally {
      wx.hideLoading();
    }
  },

  async loadRoomsByBuilding(buildingId) {
    try {
      const roomRes = await request.request({ 
        cloudFunc: 'room', 
        data: { action: 'listByBuilding', buildingId: buildingId } 
      });
      const rooms = roomRes.rooms || [];
      this.setData({ rooms, filteredRooms: rooms });
      this.updateCounts();
    } catch (error) {
      wx.showToast({ title: '加载房间失败', icon: 'none' });
      console.error("Error loading rooms:", error);
    }
  },

  onBuildingChange: function (e) {
    const index = e.detail.value;
    this.setData({ buildingIndex: index });
    const buildingId = this.data.buildings[index].id;
    this.loadRoomsByBuilding(buildingId);
  },

  onSearchInput: function (e) {
    const keyword = e.detail.value.toLowerCase();
    const filteredRooms = this.data.rooms.filter(room => 
      room.roomName.toLowerCase().includes(keyword)
    );
    this.setData({ searchKeyword: keyword, filteredRooms });
  },

  updateCounts: function () {
    const rentedCount = this.data.rooms.filter(r => r.status === 2).length;
    const vacantCount = this.data.rooms.length - rentedCount;
    this.setData({ rentedCount, vacantCount });
  },

  onDeleteRooms: function () {
    this.setData({ deleteMode: true, selectedRooms: [] });
  },

  onCancelDelete: function () {
    const rooms = this.data.filteredRooms.map(r => ({ ...r, checked: false }));
    this.setData({ deleteMode: false, selectedRooms: [], filteredRooms: rooms });
  },

  onConfirmDelete: async function () {
    const { selectedRooms } = this.data;
    if (selectedRooms.length === 0) {
      wx.showToast({ title: '请选择房间', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedRooms.length} 个房间吗？`,
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          try {
            await request.request({
              cloudFunc: 'room',
              data: { action: 'batchDelete', roomIds: selectedRooms }
            });
            wx.hideLoading();
            wx.showToast({ title: '删除成功' });
            this.setData({ deleteMode: false, selectedRooms: [] });
            this.loadBuildingsAndRooms();
          } catch (error) {
            wx.hideLoading();
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  onCheckboxChange: function (e) {
    const { id } = e.currentTarget.dataset;
    const { filteredRooms, selectedRooms } = this.data;
    
    const room = filteredRooms.find(r => r._id === id);
    if (room) {
      room.checked = !room.checked;
      if (room.checked) {
        selectedRooms.push(id);
      } else {
        const index = selectedRooms.indexOf(id);
        if (index > -1) {
          selectedRooms.splice(index, 1);
        }
      }
      this.setData({ filteredRooms, selectedRooms });
    }
  },

  onAddRoom: function () {
    const buildingId = this.data.buildings[this.data.buildingIndex].id;
    wx.navigateTo({
      url: `/pages/room-edit/room-edit?buildingId=${buildingId}`,
    });
  },

  navigateToRoomDetail: function (e) {
    if (this.data.deleteMode) return;
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/roomDetail/roomDetail?id=${id}`,
    });
  },

  goToBuildingManage: function() {
    wx.navigateTo({
      url: '/pages/building-manage/building-manage',
    });
  },

  goToBatchRent: function() {
    const buildingId = this.data.buildings[this.data.buildingIndex].id;
    wx.navigateTo({
      url: `/pages/batch-rent/batch-rent?buildingId=${buildingId}`,
    });
  }
});
