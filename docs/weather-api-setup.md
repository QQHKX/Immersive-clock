# 和风天气API配置指南

## 概述

本应用使用和风天气API来获取实时天气数据。如果不配置API密钥，应用会自动使用模拟天气数据，不影响其他功能的正常使用。

## 获取API密钥

### 1. 注册账号

访问 [和风天气开发平台](https://dev.qweather.com/) 并注册一个免费账号。

### 2. 创建应用

1. 登录后进入控制台
2. 点击「创建应用」
3. 填写应用信息：
   - 应用名称：可以填写 "Immersive Clock"
   - 应用类型：选择 "Web应用"
   - 应用描述：可选填

### 3. 获取API密钥

创建应用后，您将获得一个API密钥（API Key），类似于：`1234567890abcdef1234567890abcdef`

## 配置应用

### 1. 创建环境变量文件

在项目根目录下，复制 `.env.example` 文件并重命名为 `.env.local`：

```bash
cp .env.example .env.local
```

### 2. 配置API密钥和Host

编辑 `.env.local` 文件，配置您的API密钥和可选的自定义host：

```
REACT_APP_QWEATHER_API_KEY=your_actual_api_key_here

# 可选：自定义API host地址
# REACT_APP_QWEATHER_HOST=https://your-custom-host.com/v7
```

### 3. 重启开发服务器

保存文件后，重启开发服务器以使环境变量生效：

```bash
npm run dev
```

## API限制说明

### 免费版限制

- **每天调用次数**：1,000次
- **每分钟调用次数**：无限制
- **支持城市**：全球城市
- **数据更新频率**：每小时更新

### 自定义Host配置

本应用支持通过环境变量 `REACT_APP_QWEATHER_HOST` 配置自定义API host，具有以下优势：

- 灵活配置不同的API端点
- 支持专用或代理服务器
- 提供更稳定的API访问服务
- 优化的网络连接性能

**配置方法**：
```
REACT_APP_QWEATHER_HOST=https://your-custom-host.com/v7
```

如果不配置此环境变量，应用将默认使用开发版API (`https://devapi.qweather.com/v7`)。

## 故障排除

### 常见问题

1. **403错误**：API密钥无效或已过期
   - 检查API密钥是否正确配置
   - 确认API密钥是否有效
   - 检查是否超出调用限制

2. **天气数据不更新**：
   - 检查网络连接
   - 确认API密钥配置正确
   - 查看浏览器控制台是否有错误信息

3. **显示模拟数据**：
   - 这是正常行为，当API不可用时会自动降级
   - 检查 `.env.local` 文件是否存在且配置正确

### 调试步骤

1. 打开浏览器开发者工具（F12）
2. 查看 Console 标签页的错误信息
3. 查看 Network 标签页的API请求状态
4. 确认环境变量是否正确加载

## 安全注意事项

- ⚠️ **不要将API密钥提交到版本控制系统**
- ⚠️ **不要在客户端代码中硬编码API密钥**
- ⚠️ **定期检查API密钥的使用情况**
- ✅ **使用环境变量管理敏感信息**
- ✅ **确保 `.env.local` 文件在 `.gitignore` 中**

## 相关链接

- [和风天气开发平台](https://dev.qweather.com/)
- [和风天气API文档](https://dev.qweather.com/docs/api/)
- [和风天气定价](https://dev.qweather.com/docs/finance/pricing/)