# NPM 构建说明

## 问题原因
微信小程序无法直接使用 `node_modules` 中的 npm 包，需要通过"构建 npm"功能将依赖包构建到 `miniprogram_npm` 目录。

## 解决步骤

### 在微信开发者工具中操作：

1. **打开微信开发者工具**
   - 导入项目：选择当前目录作为项目根目录

2. **构建 npm**
   - 点击菜单栏：工具 → 构建 npm
   - 或者点击：项目 → 构建 npm
   - 等待构建完成

3. **验证构建结果**
   - 项目根目录会生成 `miniprogram_npm` 文件夹
   - 里面包含构建后的 `@vant/weapp` 组件

## 构建后的目录结构
```
rental-landlord-mp/
├── miniprogram_npm/     # 构建后的npm包 (新生成)
│   └── @vant/
│       └── weapp/
├── node_modules/        # 原始npm包
│   └── @vant/
│       └── weapp/
└── ...其他文件
```

## 注意事项

1. **每次修改 package.json 后**，都需要重新构建 npm
2. **构建前确保**：
   - package.json 中有正确的依赖声明
   - 已经运行过 `npm install`
3. **如果构建失败**：
   - 检查 package.json 格式
   - 检查网络连接
   - 重新运行 `npm install`

## 当前依赖包
- `@vant/weapp`: ^1.11.6 (UI组件库)
- `mobx-miniprogram`: ^4.13.2 (状态管理)
- `mobx-miniprogram-bindings`: ^2.0.3 (状态管理绑定)

## 完成构建后

### 第1步：恢复组件配置
将 `vant-components-config.json` 中的 usingComponents 配置复制到 `app.json` 中：

```json
{
  "pages": [...],
  "window": {...},
  "tabBar": {...},
  "usingComponents": {
    "van-button": "@vant/weapp/button/index",
    "van-cell": "@vant/weapp/cell/index",
    // ... 其他组件
  }
}
```

### 第2步：验证组件
所有 Vant Weapp 组件将正常工作，包括：
- van-button, van-cell, van-field 等基础组件
- van-toast, van-dialog, van-popup 等交互组件

### 当前状态
- ✅ npm 依赖已安装
- ⏳ 等待构建 npm（需要在微信开发者工具中操作）
- ⏳ 恢复组件配置（构建完成后）