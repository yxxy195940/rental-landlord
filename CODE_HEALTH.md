# 代码体检与整改优先级

面向：个人房东租赁小程序。聚焦删除无用代码、补齐需求缺口，并给出重构优先级。

## 高优先级（先处理）
- **云环境与调用模式对齐（已修复）**：`app.js` 现使用 `utils/config.js.cloudConfig.env`，并统一为 `cloud1-2gy34tuh656ffa81`，避免错环境调用。后续如切换远端 API，只需改配置。
- **房间状态值统一（已修复）**：前后端统一为 1=空置、2=已租，移除维修状态。更新了云函数校验、状态文案/图标、工具方法映射。
- **未使用的 MobX store（已清理）**：删除了未被引用的 `store/index.js`，避免缺少依赖导致构建隐患。
- **空白/调试页面（已移除）**：删除 `pages/quickRent/*` 与 `pages/test-cloud/*` 并从 `app.json` 移除，防止线上暴露测试入口、减小包体积。
- **合约/账单关键字段缺失**（待补）：需求要求租期、押金、租金、交租日、卫生费/水电费/其他条款等。当前 `pages/rent-register/rent-register.js` 仅有租客姓名/电话、起租日、月租/押金，缺租期、交租日、杂费条目；`pages/checkout-register/checkout-register.js` 退房仅手填金额，无基于抄表/合同的自动结算。需补齐字段并将抄表结果驱动账单生成。

## 中优先级（可并行推进）
- **双轨请求封装未落地**：`utils/request.js` 同时支持云函数与 REST，但 API 路径/鉴权/重试缺真实配置，页面只走云函数分支。建议：若近期不接入远端 API，则精简为云函数模式；若要保留双轨，需补充 baseUrl、token 刷新和错误码映射。
- **楼栋/房间创建与更新数据模型不一致**：`pages/room-edit/room-edit.js` 使用 `roomNumber` + `feeStandard.*`，云函数返回字段为 `monthlyRent`, `deposit`, `electricityPrice`, `waterPrice` 等并未嵌套，存在双重模型转换风险。建议统一数据结构并在请求层集中转换。
- **缺少收据样式与导出能力**：需求提出生成直观收据单、查询未交/已交状态。当前账单页主要列表/标记支付，未见收据模板或导出/图片生成（`cloudfunctions/bill/index.js` 留有 `generateImage` 入口但前端无调用）。需要补齐前端收据展示与生成链路。
- **个人中心能力简化**：`pages/my/my.js` 仅做头像昵称存储+快捷入口，无授权/房东信息展示/楼栋管理入口指引。可补充房东信息、数据概览以及模式切换（云函数/远端 API）的设置入口。

## 低优先级（可暂缓）
- **工具脚本与图标转换脚本未注明用途**：`convert-icons.js`, `convert-svg-to-png.js`, `generate-icons.js` 未在 README/文档说明触发方式。可补充说明或移出默认仓库。
- **大而全的工具库未做按需收敛**：`utils/util.js` 覆盖密码校验、文件大小、身份证等与业务弱相关函数，页面几乎未用。后续可按使用情况拆分/删除，减少包体积。
- **数据库导出文件未串联**：根目录 `rental_system_db.sql` 可能为参考结构，与云开发集合(bills/buildings/meter/rooms) 未同步。可补充备注或迁移文档，避免与实际结构混淆。

## 重要模块速览（便于上手）
- `utils/request.js`：统一的请求封装，`request` 会根据 `config.useCloud` 在 `wx.cloud.callFunction` 和 `wx.request` 之间切换，并内置 Loading/重试/业务码处理。
- `pages/*` 前端入口：`index` 提供统计入口；`rooms`/`building-manage` 管理房源；`meter-batch` 批量抄表；`bills` 账单列表；`rent-register`/`checkout-register` 分别做出租与退租登记。
- `cloudfunctions/*`：`building`/`room`/`meter`/`bill`/`user` 分别对应核心后端逻辑，状态/字段以云函数返回为准。
