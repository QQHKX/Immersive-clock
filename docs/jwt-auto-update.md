# JWT Token 自动更新机制

本文档说明了和风天气 JWT Token 的自动更新实现方案。

## 📋 概述

由于和风天气 API 的 JWT Token 最大有效期只有 24 小时，我们使用 GitHub Actions 实现自动更新机制：

**主要方案**：GitHub Actions + Deploy Hooks

## 🚀 GitHub Actions 自动更新方案

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

### 1. 配置 GitHub Secrets

在 GitHub 仓库中设置以下 Secrets：

1. 进入 GitHub 仓库 → Settings → Secrets and variables → Actions
2. 添加以下 Repository secrets：

| Secret名 | 说明 | 示例值 |
|----------|------|--------|
| `JWT_CONFIG` | JWT配置JSON | `{"credentialId":"KD5BDCT2TU","projectId":"26TPP7P49B"}` |
| `PRIVATE_KEY` | 完整私钥内容 | `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----` |
| `VERCEL_DEPLOY_HOOK` | Vercel部署钩子 | `https://api.vercel.com/v1/integrations/deploy/...` |

### 2. 获取 Vercel Deploy Hook

1. 进入 Vercel Dashboard
2. 选择项目 → Settings → Git
3. 创建 Deploy Hook
4. 复制 Hook URL 并添加到 GitHub Secrets

### 3. 手动触发测试

1. 进入 GitHub 仓库 → Actions
2. 选择 "Update JWT Token" 工作流
3. 点击 "Run workflow" 进行手动测试

### 4. 验证自动执行

- 检查 GitHub Actions 的执行日志
- 确认 .env.local 文件已更新
- 验证 Vercel 重新部署成功

## 📊 监控和维护

### 日志监控

**GitHub Actions 日志**：
- 访问 GitHub 仓库 → Actions
- 查看 "Update JWT Token" 工作流状态
- 检查每个步骤的执行日志

### 故障排除

#### 常见问题

1. **GitHub Secrets 配置错误**
   - 检查 `JWT_CONFIG`、`PRIVATE_KEY`、`VERCEL_DEPLOY_HOOK` 是否正确设置
   - 确认私钥格式包含完整的头尾标识

2. **JWT 生成失败**
   - 检查私钥内容和格式
   - 确认凭据ID和项目ID正确
   - 验证 JWT_CONFIG JSON 格式

3. **部署钩子失败**
   - 验证 Deploy Hook URL 是否有效
   - 检查网络连接和权限

4. **文件提交失败**
   - 检查 GitHub Actions 是否有仓库写入权限
   - 确认 .env.local 文件路径正确

### 维护建议

1. **定期检查**：每周检查一次 GitHub Actions 执行状态
2. **备份机制**：保持手动更新脚本作为备份
3. **监控告警**：设置 GitHub Actions 失败通知
4. **安全审计**：定期更换 GitHub Secrets

## 🔒 安全注意事项

1. **私钥保护**：
   - 私钥仅存储在 GitHub Secrets 中
   - 不要在代码中硬编码私钥
   - 定期轮换私钥（建议每季度）

2. **仓库安全**：
   - 限制仓库访问权限
   - 定期审查 GitHub Actions 权限
   - 监控异常提交活动

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