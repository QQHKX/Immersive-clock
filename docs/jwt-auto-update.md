# JWT Token 自动更新机制

本文档说明了和风天气 JWT Token 在 Vercel 平台上的自动更新实现方案。

## 📋 概述

由于和风天气 API 的 JWT Token 最大有效期只有 24 小时，我们实现了两套自动更新机制：

1. **主要方案**：Vercel Serverless Functions + Cron Jobs
2. **备选方案**：GitHub Actions + Deploy Hooks

## 🚀 方案一：Vercel Serverless Functions（推荐）

### 架构说明

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vercel Cron   │───▶│  Serverless API  │───▶│  新 JWT Token   │
│   (每12小时)    │    │  /api/update-jwt │    │   自动生成      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  触发重新部署    │
                       │  (Deploy Hook)   │
                       └──────────────────┘
```

### 核心文件

#### 1. `/api/update-jwt.js`
- **功能**：Vercel Serverless Function，负责生成新的 JWT Token
- **触发方式**：Vercel Cron Jobs 每 12 小时自动调用
- **安全验证**：需要 Bearer Token 授权
- **错误处理**：完整的错误日志和状态返回

#### 2. `vercel.json` 配置
```json
{
  "crons": [
    {
      "path": "/api/update-jwt",
      "schedule": "0 */12 * * *"
    }
  ],
  "functions": {
    "api/update-jwt.js": {
      "maxDuration": 30
    }
  },
  "env": {
    "QWEATHER_CREDENTIAL_ID": "@qweather-credential-id",
    "QWEATHER_PROJECT_ID": "@qweather-project-id",
    "QWEATHER_PRIVATE_KEY": "@qweather-private-key",
    "UPDATE_JWT_SECRET": "@update-jwt-secret",
    "VERCEL_DEPLOY_HOOK": "@vercel-deploy-hook"
  }
}
```

### 环境变量配置

在 Vercel Dashboard 中设置以下环境变量：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `QWEATHER_CREDENTIAL_ID` | 和风天气凭据ID | `KD5BDCT2TU` |
| `QWEATHER_PROJECT_ID` | 和风天气项目ID | `26TPP7P49B` |
| `QWEATHER_PRIVATE_KEY` | Ed25519私钥内容 | `-----BEGIN PRIVATE KEY-----\n...` |
| `UPDATE_JWT_SECRET` | API访问密钥 | `your-secret-key-here` |
| `VERCEL_DEPLOY_HOOK` | 部署钩子URL | `https://api.vercel.com/v1/integrations/deploy/...` |

### 工作流程

1. **定时触发**：Vercel Cron 每 12 小时执行一次
2. **安全验证**：检查 Bearer Token 授权
3. **读取配置**：从环境变量获取和风天气配置
4. **生成Token**：使用 Ed25519 算法生成新的 JWT Token
5. **触发部署**：调用 Deploy Hook 重新部署应用
6. **日志记录**：记录成功/失败状态和详细信息

## 🔄 方案二：GitHub Actions（备选）

### 架构说明

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  GitHub Cron    │───▶│  Actions Runner  │───▶│  更新 .env.local │
│   (每12小时)    │    │  生成新 Token    │    │   提交到仓库     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  触发 Vercel    │
                       │  重新部署        │
                       └──────────────────┘
```

### 核心文件

#### `.github/workflows/update-jwt.yml`
- **功能**：GitHub Actions 工作流，自动更新 JWT Token
- **触发方式**：GitHub Cron + 手动触发
- **操作流程**：生成Token → 更新文件 → 提交代码 → 触发部署

### GitHub Secrets 配置

| Secret名 | 说明 | 示例值 |
|----------|------|--------|
| `JWT_CONFIG` | JWT配置JSON | `{"credentialId":"KD5BDCT2TU",...}` |
| `PRIVATE_KEY` | 完整私钥内容 | `-----BEGIN PRIVATE KEY-----\n...` |
| `VERCEL_DEPLOY_HOOK` | Vercel部署钩子 | `https://api.vercel.com/v1/...` |

## 🛠️ 部署步骤

### 1. 配置 Vercel 环境变量

```bash
# 在 Vercel Dashboard 中添加环境变量
QWEATHER_CREDENTIAL_ID=KD5BDCT2TU
QWEATHER_PROJECT_ID=26TPP7P49B
QWEATHER_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
[您的私钥内容]
-----END PRIVATE KEY-----"
UPDATE_JWT_SECRET=your-secret-key-here
VERCEL_DEPLOY_HOOK=https://api.vercel.com/v1/integrations/deploy/[hook-id]
```

### 2. 获取 Vercel Deploy Hook

1. 进入 Vercel Dashboard
2. 选择项目 → Settings → Git
3. 创建 Deploy Hook
4. 复制 Hook URL

### 3. 测试 API 端点

```bash
# 手动测试 Serverless Function
curl -X POST https://your-app.vercel.app/api/update-jwt \
  -H "Authorization: Bearer your-secret-key-here" \
  -H "Content-Type: application/json"
```

### 4. 验证 Cron Jobs

- 在 Vercel Dashboard → Functions → Crons 中查看执行状态
- 检查函数日志确认执行成功

## 📊 监控和维护

### 日志监控

1. **Vercel 函数日志**：
   - 访问 Vercel Dashboard → Functions
   - 查看 `/api/update-jwt` 的执行日志

2. **GitHub Actions 日志**：
   - 访问 GitHub 仓库 → Actions
   - 查看 "Update JWT Token" 工作流状态

### 故障排除

#### 常见问题

1. **401 Unauthorized**
   - 检查 `UPDATE_JWT_SECRET` 环境变量
   - 确认 Authorization Header 格式正确

2. **500 Missing configuration**
   - 检查所有必需的环境变量是否设置
   - 验证私钥格式是否正确

3. **JWT 生成失败**
   - 检查私钥内容和格式
   - 确认凭据ID和项目ID正确

4. **部署钩子失败**
   - 验证 Deploy Hook URL 是否有效
   - 检查网络连接和权限

### 维护建议

1. **定期检查**：每周检查一次自动更新状态
2. **备份机制**：保持手动更新脚本作为备份
3. **监控告警**：设置 Token 过期告警（可选）
4. **安全审计**：定期更换 API 访问密钥

## 🔒 安全注意事项

1. **私钥保护**：
   - 私钥仅存储在 Vercel 环境变量中
   - 不要在代码中硬编码私钥
   - 定期轮换私钥（建议每季度）

2. **API 安全**：
   - 使用强密码作为 `UPDATE_JWT_SECRET`
   - 限制 API 访问来源（如果需要）
   - 监控异常访问模式

3. **权限控制**：
   - 最小权限原则设置环境变量
   - 定期审查访问权限
   - 使用 Vercel Teams 管理权限（如适用）

## 📈 性能优化

1. **函数优化**：
   - 设置合适的函数超时时间（30秒）
   - 优化依赖加载和执行时间

2. **调度优化**：
   - 12小时间隔确保 Token 不会过期
   - 避免在高峰时段执行（如需要）

3. **错误重试**：
   - 实现指数退避重试机制
   - 设置最大重试次数限制

---

## 📞 支持

如果遇到问题，请检查：

1. [Vercel 函数日志](https://vercel.com/dashboard)
2. [GitHub Actions 状态](https://github.com/your-repo/actions)
3. [和风天气控制台](https://console.qweather.com/)

更多技术支持，请参考：
- [Vercel Cron Jobs 文档](https://vercel.com/docs/cron-jobs)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [和风天气 API 文档](https://dev.qweather.com/)