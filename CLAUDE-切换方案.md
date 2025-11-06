# 房租管理系统 - 房东微信小程序

轻量级房租管理小程序，正在从传统后端架构迁移到微信云开发。

## 当前状态

- ✅ 已完成：基础页面结构、UI组件集成
- 🔄 进行中：将API调用改造为云函数
- ⏳ 待完成：微信支付、消息推送

## 技术栈

- 小程序：原生微信小程序
- UI组件：Vant Weapp（已集成）
- 数据：
  - 当前：调用Spring Boot API（[http://localhost:8080）](http://localhost:8080）/)
  - 目标：微信云开发（云函数+云数据库）

## 迁移计划

### 第一阶段：双轨运行

保留原有API调用，新增云函数实现，通过配置切换：

javascript

```javascript
// utils/config.js
export const config = {
  useCloud: true,  // true: 使用云开发, false: 使用传统API
  apiBaseUrl: 'http://localhost:8080'
}
```

### 第二阶段：逐个功能迁移

1. 用户登录（优先级：高）- 获取openid
2. 房间列表（优先级：高）- 简单CRUD
3. 快速出租（优先级：中）
4. 抄表功能（优先级：中）
5. 账单生成（优先级：低）

## 当前任务

将房间列表功能迁移到云开发：

1. 创建 `cloudfunctions/room` 云函数
2. 实现 getRoomList 方法
3. 修改 `pages/rooms/index.js` 支持双轨调用
4. 测试云函数版本

## 代码改造示例

javascript

```javascript
// utils/request.js - 支持双轨的请求封装
import { config } from './config'

export async function request(options) {
  if (config.useCloud) {
    // 调用云函数
    return wx.cloud.callFunction({
      name: options.cloudFunc,
      data: options.data
    })
  } else {
    // 调用传统API
    return wx.request({
      url: config.apiBaseUrl + options.url,
      method: options.method,
      data: options.data
    })
  }
}

// pages/rooms/index.js - 使用示例
async getRoomList() {
  const res = await request({
    // 云函数配置
    cloudFunc: 'room',
    data: { action: 'list' },
    // 传统API配置
    url: '/api/rooms',
    method: 'GET'
  })
  
  this.setData({
    roomList: res.data
  })
}
```

## 云函数模板

javascript

```javascript
// cloudfunctions/room/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action, ...params } = event
  const { OPENID } = cloud.getWXContext()
  
  // 添加详细日志便于调试
  console.log('云函数调用：', { action, params, OPENID })
  
  try {
    switch (action) {
      case 'list':
        return await getRoomList(OPENID)
      case 'bindTenant':
        return await bindTenant(params, OPENID)
      default:
        return { code: -1, msg: '未知操作' }
    }
  } catch (error) {
    console.error('云函数错误：', error)
    return { code: -1, msg: error.message }
  }
}

// 保持与原API相似的返回格式
async function getRoomList(openid) {
  const res = await db.collection('rooms')
    .where({ landlordId: openid })
    .get()
    
  return {
    code: 200,
    message: 'success',
    data: res.data
  }
}
```

## 数据迁移策略

原MySQL表结构 → 云数据库集合映射：

- users表 → users集合（添加_openid字段）
- rooms表 → rooms集合（外键改为直接存储）
- bills表 → bills集合

## 注意事项

1. 保持返回数据格式一致，减少前端修改
2. 云函数中使用 console.log 便于调试
3. 逐个功能测试，确保稳定后再迁移下一个
4. 保留原API代码，便于回滚

## 下一步指令示例

"将getRoomList功能迁移到云函数，保持与原API相同的返回格式，同时在前端添加配置开关支持双轨运行"

## 云开发配置

### 云函数目录结构
```
cloudfunctions/
├── room/              # 房间管理
│   ├── index.js       # 云函数入口
│   └── package.json   # 依赖配置
├── user/              # 用户管理
│   ├── index.js
│   └── package.json
├── bill/              # 账单管理
│   ├── index.js
│   └── package.json
└── common/            # 公共工具
    ├── index.js
    └── package.json
```

### 云数据库集合设计

#### users 集合
```javascript
{
  _id: "auto-generated",
  _openid: "user-openid",
  username: "房东姓名",
  phone: "联系电话",
  avatar: "头像URL",
  createTime: "创建时间",
  updateTime: "更新时间"
}
```

#### rooms 集合
```javascript
{
  _id: "auto-generated",
  _openid: "landlord-openid",
  roomNumber: "房间号",
  address: "详细地址",
  rent: 1500,
  deposit: 1500,
  area: 25,
  isRented: false,
  tenantInfo: {
    name: "租客姓名",
    phone: "租客电话",
    idCard: "身份证号"
  },
  rentStartDate: "租赁开始日期",
  rentEndDate: "租赁结束日期",
  createTime: "创建时间",
  updateTime: "更新时间"
}
```

#### bills 集合
```javascript
{
  _id: "auto-generated",
  _openid: "landlord-openid",
  roomId: "房间ID",
  roomNumber: "房间号",
  billType: "rent|water|electric|gas",
  amount: 1500,
  billDate: "账单日期",
  dueDate: "到期日期",
  isPaid: false,
  paidDate: "支付日期",
  remark: "备注",
  createTime: "创建时间",
  updateTime: "更新时间"
}
```

## 云函数开发规范

### 错误处理
```javascript
// 统一错误返回格式
const errorResponse = (code, message, data = null) => {
  return {
    code,
    message,
    data,
    timestamp: new Date().getTime()
  }
}

// 成功返回格式
const successResponse = (data, message = 'success') => {
  return {
    code: 200,
    message,
    data,
    timestamp: new Date().getTime()
  }
}
```

### 权限验证
```javascript
// 验证用户权限
const checkPermission = async (openid, roomId) => {
  const room = await db.collection('rooms').doc(roomId).get()
  if (room.data._openid !== openid) {
    throw new Error('无权限访问')
  }
  return room.data
}
```

### 日志记录
```javascript
// 记录操作日志
const logOperation = (action, openid, data) => {
  console.log(`[${new Date().toISOString()}] ${action}`, {
    openid,
    data
  })
}
```

## 测试策略

### 云函数测试
1. 使用微信开发者工具本地测试
2. 云端测试验证权限和数据
3. 性能测试确保响应时间

### 数据一致性测试
1. 对比云函数与原API返回数据
2. 验证数据格式兼容性
3. 测试异常情况处理

## 部署流程

### 云函数部署
```bash
# 在微信开发者工具中
1. 右键云函数目录
2. 选择"上传并部署"
3. 选择"云端安装依赖"
```

### 数据库初始化
```bash
# 在云开发控制台
1. 创建数据库集合
2. 设置索引
3. 配置权限
```

###   📋 数据库集合结构

  创建 buildings 集合，参考数据结构：
  {
    "_id": "自动生成",
    "landlordId": "房东openId",
    "name": "1栋",
    "address": "详细地址",
    "floors": 4,
    "roomCount": 0,
    "isDeleted": false,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }



## Claude 开发任务

### 云函数生成
- 根据功能需求生成标准云函数模板
- 保持与原API相同的返回格式
- 添加完整的错误处理

### 代码重构
- 将传统API调用改造为云函数调用
- 保持前端代码最小修改
- 添加配置开关支持双轨运行

### 数据迁移
- 分析现有数据结构
- 生成云数据库集合设计
- 提供数据迁移脚本

## 开发提示

1. 优先使用云开发，降低服务器成本
2. 保持API格式一致性，便于切换
3. 添加详细日志，方便调试
4. 实现渐进式迁移，降低风险
5. 保留回滚机制，确保服务稳定



## 小程序前端样式

页面结构：
- 顶部：固定导航栏，高度 50px
- 中间：可滚动内容区
- 底部：固定操作按钮

布局风格：
- 整体采用白色背景
- 主色调 仿照微信

**房间卡片：**

```
外观：
- 白色背景卡片
- 四周阴影，营造浮起效果
- 内边距 15px

内容布局：
┌─────────────────────────┐
│ 101室        已出租 🟢  │ <- 标题行：房间名左对齐，状态右对齐
│ ─────────────────────── │ <- 分割线
│ 租客：张三   1500元/月   │ <- 信息行：灰色小字
│ 📱 138****8000          │ <- 联系方式
└─────────────────────────┘
```



页面布局图

```
┌─────────────────────────────┐
│           房间管理            │ 50px
├─────────────────────────────┤
│  搜索框 [🔍 搜索房间号]       │ 60px
├─────────────────────────────┤
┌─────────────────────────┐
│ 总房间：10  已租：8  空置：2 │	|
└─────────────────────────┘
├─────────────────────────────┤
│  ┌─────────────────────┐    │
│  │   房间卡片 1         │    │
│  └─────────────────────┘    │ 
│                             │ 可滚动
│  ┌─────────────────────┐    │
│  │   房间卡片 2         │    │
│  └─────────────────────┘    │
├─────────────────────────────┤
│ [删除房间]   [添加房间]        │ 80px (底部按钮)
└─────────────────────────────┘
```



房间管理页面的样式有问题，按照上面给的调整代码，

- 点击删除房间按钮后是在房间卡片左侧弹出复选框，底部左右两个按钮变为确认和取消