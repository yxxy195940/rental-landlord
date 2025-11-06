/**
 * 应用配置文件
 * 
 * 用于控制应用的运行模式，支持在云开发和传统API之间切换
 */

export const config = {
  // 核心配置：选择运行模式
  useCloud: true, // true: 使用云开发, false: 使用传统API
  
  // 云开发配置
  cloudConfig: {
    env: 'rental-system-env', // 云环境ID
    timeout: 10000, // 云函数超时时间(毫秒)
    retryCount: 2, // 重试次数
  },
  
  // 传统API配置
  apiConfig: {
    baseUrl: 'https://api.rental.com', // API基础地址
    timeout: 10000, // 请求超时时间(毫秒)
    retryCount: 3, // 重试次数
  },
  
  // 调试配置
  debug: {
    enabled: true, // 是否启用调试模式
    logLevel: 'info', // 日志级别: debug, info, warn, error
    showCloudFunctionLogs: true, // 是否显示云函数日志
  },
  
  // 缓存配置
  cache: {
    enabled: true, // 是否启用缓存
    timeout: 5 * 60 * 1000, // 缓存过期时间(毫秒)
    maxSize: 100, // 最大缓存数量
  },
  
  // 业务配置
  business: {
    pageSize: 20, // 分页大小
    maxRetryCount: 3, // 最大重试次数
    loadingTimeout: 30000, // 加载超时时间
  }
}

// 导出配置获取方法
export function getConfig(key) {
  if (!key) return config
  
  const keys = key.split('.')
  let value = config
  
  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k]
    } else {
      return undefined
    }
  }
  
  return value
}

// 导出配置更新方法
export function updateConfig(key, value) {
  const keys = key.split('.')
  let target = config
  
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (target && typeof target === 'object') {
      target = target[k]
    } else {
      console.warn(`配置路径不存在: ${key}`)
      return false
    }
  }
  
  if (target && typeof target === 'object') {
    target[keys[keys.length - 1]] = value
    console.log(`配置更新成功: ${key} = ${value}`)
    return true
  }
  
  console.warn(`配置更新失败: ${key}`)
  return false
}

// 导出日志方法
export function log(level, message, data = null) {
  if (!config.debug.enabled) return
  
  const logLevels = { debug: 0, info: 1, warn: 2, error: 3 }
  const currentLevel = logLevels[config.debug.logLevel] || 1
  const messageLevel = logLevels[level] || 1
  
  if (messageLevel >= currentLevel) {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`
    
    switch (level) {
      case 'debug':
        console.log(logMessage, data)
        break
      case 'info':
        console.info(logMessage, data)
        break
      case 'warn':
        console.warn(logMessage, data)
        break
      case 'error':
        console.error(logMessage, data)
        break
      default:
        console.log(logMessage, data)
    }
  }
}

export default config