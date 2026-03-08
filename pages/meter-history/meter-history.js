import request from '../../utils/request'
import { dateUtils } from '../../utils/util'

Page({
  data: {
    buildings: [],
    buildingIndex: 0,
    rooms: [],
    roomIndex: 0,
    meterRecords: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    listLoading: false,
    initialLoading: true,
    emptyMessage: '请选择房间查看抄表记录',
    activeTab: 'water',
    currentRoomLabel: '',
    initialRoomId: ''
  },

  onTabChange(e) {
    const { tab } = e.currentTarget.dataset
    if (tab === this.data.activeTab) return
    this.setData({ activeTab: tab }, () => this.refreshRecords())
  },

  onLoad(options) {
    if (options && options.roomId) {
      this.setData({ initialRoomId: options.roomId })
    }
    this.loadBuildings()
  },

  onPullDownRefresh() {
    this.refreshRecords().finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.listLoading) return
    this.setData({ page: this.data.page + 1 }, () => this.loadMeterHistory(false))
  },

  async loadBuildings() {
    this.setData({ initialLoading: true })
    try {
      // 如果有初始房间ID，先获取其所属楼栋ID
      let targetBuildingId = ''
      if (this.data.initialRoomId) {
        const roomRes = await request.request({
          cloudFunc: 'room',
          data: {
            action: 'detail',
            roomId: this.data.initialRoomId
          }
        })
        if (roomRes && roomRes.buildingId) {
          targetBuildingId = roomRes.buildingId
        }
      }

      const res = await request.request({
        cloudFunc: 'building',
        data: { action: 'list' }
      })
      const buildingList = res.list || []
      
      let buildingIndex = 0
      if (targetBuildingId && buildingList.length > 0) {
        const foundIndex = buildingList.findIndex(b => b.id === targetBuildingId)
        if (foundIndex !== -1) buildingIndex = foundIndex
      }

      this.setData({
        buildings: buildingList,
        buildingIndex: buildingIndex
      })

      if (buildingList.length > 0) {
        await this.loadRoomsForBuilding(buildingList[buildingIndex].id)
      } else {
        this.setData({
          rooms: [],
          meterRecords: [],
          emptyMessage: '暂无楼栋信息',
          currentRoomLabel: ''
        })
      }
    } catch (error) {
      console.error('加载楼栋失败:', error)
      wx.showToast({ title: '加载楼栋失败', icon: 'none' })
      this.setData({ initialLoading: false })
    }
  },

  async loadRoomsForBuilding(buildingId) {
    if (!buildingId) {
      this.setData({
        rooms: [],
        meterRecords: [],
        emptyMessage: '暂无楼栋信息',
        initialLoading: false
      })
      return
    }

    try {
      this.setData({ listLoading: true })
      const res = await request.request({
        cloudFunc: 'room',
        data: {
          action: 'listByBuilding',
          buildingId
        }
      })
      const rooms = res.rooms || []
      
      let roomIndex = 0
      if (this.data.initialRoomId && rooms.length > 0) {
        const foundIndex = rooms.findIndex(r => (r._id || r.id) === this.data.initialRoomId)
        if (foundIndex !== -1) roomIndex = foundIndex
      }

      this.setData({
        rooms,
        roomIndex: roomIndex,
        initialRoomId: '' // 清除初始ID，避免后续切换楼栋时又跳回该房间
      }, () => this.updateRoomLabel())

      if (rooms.length === 0) {
        this.setData({
          meterRecords: [],
          emptyMessage: '该楼栋暂无房间',
          listLoading: false,
          initialLoading: false,
          currentRoomLabel: ''
        })
        return
      }

      await this.refreshRecords()
    } catch (error) {
      console.error('加载房间失败:', error)
      wx.showToast({ title: '加载房间失败', icon: 'none' })
    } finally {
      this.setData({ initialLoading: false, listLoading: false })
    }
  },

  async refreshRecords() {
    this.setData({
      page: 1,
      hasMore: true,
      meterRecords: [],
      emptyMessage: '暂无抄表记录',
      listLoading: true
    })
    await this.loadMeterHistory(true)
  },

  async loadMeterHistory(reset = false) {
    const room = this.data.rooms[this.data.roomIndex]
    const roomId = room?._id || room?.id

    if (!roomId) {
      this.setData({
        meterRecords: [],
        hasMore: false,
        listLoading: false,
        emptyMessage: '请先选择房间'
      })
      return
    }

    try {
      this.setData({ listLoading: true })
      const { page, pageSize, meterRecords } = this.data
      const res = await request.request({
        cloudFunc: 'meter',
        data: {
          action: 'getHistory',
          roomId,
          page,
          pageSize,
          meterType: this.data.activeTab
        }
      })

      const list = (res.list || []).map(item => this.formatMeterRecord(item))
      this.setData({
        meterRecords: reset ? list : meterRecords.concat(list),
        hasMore: res.hasMore !== undefined ? res.hasMore : (page * pageSize < (res.total || 0)),
        emptyMessage: list.length === 0 && page === 1 ? '暂无抄表记录' : this.data.emptyMessage
      })
    } catch (error) {
      console.error('加载抄表记录失败:', error)
      wx.showToast({ title: '加载抄表记录失败', icon: 'none' })
    } finally {
      this.setData({ listLoading: false })
    }
  },

  onBuildingChange(e) {
    const index = Number(e.detail.value)
    this.setData({
      buildingIndex: index
    })
    const buildingId = this.data.buildings[index]?.id
    this.loadRoomsForBuilding(buildingId)
  },

  onRoomChange(e) {
    const index = Number(e.detail.value)
    this.setData({
      roomIndex: index
    }, () => this.updateRoomLabel())
    this.refreshRecords()
  },

  updateRoomLabel() {
    const building = this.data.buildings[this.data.buildingIndex]
    const room = this.data.rooms[this.data.roomIndex]
    if (!room) {
      this.setData({ currentRoomLabel: '' })
      return
    }
    const buildingName = room.buildingName || building?.name || ''
    const roomName = room.roomName || ''
    this.setData({
      currentRoomLabel: `${buildingName} ${roomName}`.trim()
    })
  },

  formatMeterRecord(record) {
    const fallbackTime = record.recordDate || record.updatedAt || record.createdAt
    const waterTime = record.waterRecordTime || fallbackTime
    const electricityTime = record.electricityRecordTime || fallbackTime

    return {
      ...record,
      waterReadingText: record.waterReading !== undefined && record.waterReading !== null
        ? `${record.waterReading}`
        : '--',
      electricityReadingText: record.electricityReading !== undefined && record.electricityReading !== null
        ? `${record.electricityReading}`
        : '--',
      waterTimeText: waterTime ? dateUtils.format(waterTime, 'YYYY-MM-DD HH:mm') : '未记录时间',
      electricityTimeText: electricityTime ? dateUtils.format(electricityTime, 'YYYY-MM-DD HH:mm') : '未记录时间'
    }
  }
})
