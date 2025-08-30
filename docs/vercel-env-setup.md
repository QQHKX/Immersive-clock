# Vercel 环境变量配置指南

本文档指导您如何在 Vercel Dashboard 中配置 JWT Token 自动更新所需的环境变量。

## 🔧 环境变量配置

### 1. 登录 Vercel Dashboard

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择您的 `Immersive-clock` 项目
3. 进入 **Settings** → **Environment Variables**

### 2. 添加以下环境变量

请按照以下格式逐一添加环境变量：

#### 和风天气配置

**变量名**: `QWEATHER_CREDENTIAL_ID`  
**值**: `KD5BDCT2TU`  
**环境**: `Production`, `Preview`, `Development` (全选)

**变量名**: `QWEATHER_PROJECT_ID`  
**值**: `26TPP7P49B`  
**环境**: `Production`, `Preview`, `Development` (全选)

**变量名**: `QWEATHER_PRIVATE_KEY`  
**值**: 
```
-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIL+1gG+mWxcmaekCm//+ULS12LYY7r+IbLR3glKVxATN
-----END PRIVATE KEY-----
```
**环境**: `Production`, `Preview`, `Development` (全选)

#### 安全配置

**变量名**: `UPDATE_JWT_SECRET`  
**值**: `lzq1314`  
**环境**: `Production`, `Preview`, `Development` (全选)

#### 部署钩子配置

**变量名**: `VERCEL_DEPLOY_HOOK`  
**值**: `https://api.vercel.com/v1/integrations/deploy/prj_StjmE9GNKQRrARanOuzX0rfOy5gQ/muf2fpxFyr`  
**环境**: `Production`, `Preview`, `Development` (全选)

## 📋 配置步骤详解

### 步骤 1: 添加和风天气凭据

1. 点击 **Add New** 按钮
2. 输入变量名: `QWEATHER_CREDENTIAL_ID`
3. 输入值: `KD5BDCT2TU`
4. 选择所有环境 (Production, Preview, Development)
5. 点击 **Save**

重复以上步骤添加 `QWEATHER_PROJECT_ID`。

### 步骤 2: 添加私钥

⚠️ **重要**: 私钥需要包含完整的 PEM 格式头尾

1. 点击 **Add New** 按钮
2. 输入变量名: `QWEATHER_PRIVATE_KEY`
3. 输入完整的私钥内容:
   ```
   -----BEGIN PRIVATE KEY-----
   MC4CAQAwBQYDK2VwBCIEIL+1gG+mWxcmaekCm//+ULS12LYY7r+IbLR3glKVxATN
   -----END PRIVATE KEY-----
   ```
4. 选择所有环境
5. 点击 **Save**

### 步骤 3: 添加安全密钥

1. 点击 **Add New** 按钮
2. 输入变量名: `UPDATE_JWT_SECRET`
3. 输入值: `lzq1314`
4. 选择所有环境
5. 点击 **Save**

### 步骤 4: 添加部署钩子

1. 点击 **Add New** 按钮
2. 输入变量名: `VERCEL_DEPLOY_HOOK`
3. 输入完整的钩子URL: `https://api.vercel.com/v1/integrations/deploy/prj_StjmE9GNKQRrARanOuzX0rfOy5gQ/muf2fpxFyr`
4. 选择所有环境
5. 点击 **Save**

## ✅ 验证配置

配置完成后，您应该看到以下 5 个环境变量：

- ✅ `QWEATHER_CREDENTIAL_ID`
- ✅ `QWEATHER_PROJECT_ID`
- ✅ `QWEATHER_PRIVATE_KEY`
- ✅ `UPDATE_JWT_SECRET`
- ✅ `VERCEL_DEPLOY_HOOK`

## 🚀 触发首次部署

配置完环境变量后，需要触发一次新的部署来应用这些变量：

### 方法 1: 通过 Git 推送
```bash
# 在项目目录中执行
git commit --allow-empty -m "trigger deployment with new env vars"
git push
```

### 方法 2: 通过 Vercel Dashboard
1. 进入项目的 **Deployments** 页面
2. 点击最新部署旁的 **⋯** 菜单
3. 选择 **Redeploy**

### 方法 3: 手动测试 API
```bash
# 测试自动更新 API
curl -X POST https://your-app.vercel.app/api/update-jwt \
  -H "Authorization: Bearer lzq1314" \
  -H "Content-Type: application/json"
```

## 🔍 监控和验证

### 检查 Cron Jobs 状态

1. 进入 Vercel Dashboard → 项目 → **Functions**
2. 查看 **Cron Jobs** 部分
3. 确认 `/api/update-jwt` 显示为 "Active"

### 查看执行日志

1. 进入 **Functions** → **View Function Logs**
2. 选择 `api/update-jwt.js`
3. 查看最近的执行记录和日志

### 验证 JWT Token 更新

自动更新成功后，您可以在以下位置确认：

1. **Vercel 函数日志**: 显示 "JWT token generated successfully"
2. **部署记录**: 新的部署会被自动触发
3. **应用功能**: 天气组件应该正常工作

## 🛠️ 故障排除

### 常见问题

#### 1. "Missing configuration" 错误
- **原因**: 环境变量未正确设置
- **解决**: 检查所有 5 个环境变量是否都已添加且值正确

#### 2. "Invalid private key" 错误
- **原因**: 私钥格式不正确
- **解决**: 确保私钥包含完整的 PEM 头尾标识

#### 3. "401 Unauthorized" 错误
- **原因**: `UPDATE_JWT_SECRET` 不匹配
- **解决**: 确认密钥值为 `lzq1314`

#### 4. 部署钩子调用失败
- **原因**: Deploy Hook URL 无效
- **解决**: 重新生成 Deploy Hook 并更新环境变量

### 获取帮助

如果遇到问题，请检查：

1. **Vercel 函数日志**: 详细的错误信息
2. **GitHub Actions 日志**: 备选方案的执行状态
3. **项目文档**: [JWT 自动更新机制文档](./jwt-auto-update.md)

## 🔒 安全建议

1. **定期更换密钥**: 建议每季度更换 `UPDATE_JWT_SECRET`
2. **监控访问**: 定期检查函数调用日志
3. **权限控制**: 确保只有必要的人员能访问环境变量
4. **备份配置**: 将配置信息安全保存在密码管理器中

---

配置完成后，您的 JWT Token 将每 12 小时自动更新一次，确保和风天气 API 的持续可用性！