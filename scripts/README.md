# 和风天气 JWT Token 生成工具

本工具用于生成符合和风天气API要求的JWT认证token，基于官方文档 [身份认证](https://dev.qweather.com/docs/configuration/authentication/) 实现。

## 📋 使用前准备

### 1. 安装依赖

确保您的系统已安装：
- **Node.js** (推荐 v16+): [下载地址](https://nodejs.org/)
- **OpenSSL** (用于生成密钥对):
  ```bash
  # Windows (推荐使用winget)
  winget install OpenSSL.Light
  
  # 或者下载安装包
  # https://slproweb.com/products/Win32OpenSSL.html
  ```

### 2. 生成Ed25519密钥对

在项目根目录或scripts目录下运行：

```bash
# 生成密钥对
openssl genpkey -algorithm ED25519 -out ed25519-private.pem && openssl pkey -pubout -in ed25519-private.pem > ed25519-public.pem
```

这将生成两个文件：
- `ed25519-private.pem` - 私钥（用于JWT签名，请妥善保管）
- `ed25519-public.pem` - 公钥（需要上传到和风天气控制台）

### 3. 配置和风天气控制台

1. 登录 [和风天气控制台](https://console.qweather.com/)
2. 进入 **项目管理**
3. 选择您的项目或创建新项目
4. 在凭据区域点击 **"添加凭据"**
5. 选择认证方式：**JSON Web Token**
6. 复制 `ed25519-public.pem` 文件的全部内容并粘贴到公钥文本框
7. 保存凭据
8. 记录下：
   - **凭据ID** (kid)
   - **项目ID** (sub)

## 🚀 使用方法

### 方法一：使用批处理脚本（推荐Windows用户）

1. 编辑 `generate-jwt.js` 文件中的 `CONFIG` 配置：
   ```javascript
   const CONFIG = {
     credentialId: 'YOUR_CREDENTIAL_ID',  // 替换为您的凭据ID
     projectId: 'YOUR_PROJECT_ID',        // 替换为您的项目ID
     privateKeyPath: './ed25519-private.pem',
     expirationTime: 3600 // 1小时有效期
   };
   ```

2. 双击运行 `generate-jwt.bat`

### 方法二：使用Node.js命令

1. 配置参数（同上）
2. 在scripts目录下运行：
   ```bash
   node generate-jwt.js
   ```

### 方法三：使用配置文件

1. 复制 `jwt-config.example.json` 为 `jwt-config.json`
2. 编辑 `jwt-config.json` 填入您的配置
3. 修改 `generate-jwt.js` 使用配置文件（可选）

## 📝 输出结果

成功运行后，您将看到：

```
🔐 开始生成和风天气JWT token...
📖 读取Ed25519私钥...
🏗️ 生成JWT Header...
📦 生成JWT Payload...
✍️ 生成Ed25519签名...
✅ JWT token生成成功!
📋 Token信息:
   凭据ID: ABCDE12345
   项目ID: FGHIJ67890
   有效期: 3600秒
   过期时间: 2024-01-01 15:30:00

🎯 生成的JWT Token:
eyJhbGciOiJFZERTQSIsImtpZCI6IkFCQ0RFMTIzNDUifQ...

💡 使用方法:
将上述JWT token复制到.env.local文件中的REACT_APP_QWEATHER_API_KEY变量
```

生成的JWT token还会保存到 `qweather-jwt-token.txt` 文件中。

## 🔧 配置说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `credentialId` | 和风天气控制台的凭据ID | `"ABCDE12345"` |
| `projectId` | 和风天气控制台的项目ID | `"FGHIJ67890"` |
| `privateKeyPath` | Ed25519私钥文件路径 | `"./ed25519-private.pem"` |
| `expirationTime` | JWT有效期（秒） | `3600` (1小时) |

**注意事项：**
- JWT最长有效期为24小时（86400秒）
- 建议根据使用场景设置合适的有效期
- 前端应用建议使用较短的有效期（1-6小时）
- 服务端应用可以使用较长的有效期（12-24小时）

## 🔒 安全建议

1. **私钥安全**：
   - 私钥文件不要提交到版本控制系统
   - 建议将 `*.pem` 添加到 `.gitignore`
   - 妥善保管私钥，丢失后需要重新生成

2. **JWT管理**：
   - 定期更新JWT token
   - 不要在代码中硬编码JWT
   - 使用环境变量存储JWT

3. **权限控制**：
   - 只给必要的API权限
   - 定期检查和轮换凭据

## 🛠️ 故障排除

### 常见错误

1. **"私钥文件不存在"**
   - 确保已生成Ed25519密钥对
   - 检查私钥文件路径是否正确

2. **"请配置有效的凭据ID"**
   - 检查是否已修改CONFIG中的credentialId
   - 确保凭据ID来自和风天气控制台

3. **"签名生成失败"**
   - 检查私钥文件格式是否正确
   - 确保使用Ed25519算法生成的密钥

4. **API调用401错误**
   - 检查JWT格式是否正确
   - 确认凭据ID和项目ID匹配
   - 检查JWT是否已过期

### 调试方法

1. 使用 [JWT.io](https://jwt.io/) 验证生成的JWT格式
2. 检查和风天气控制台的凭据配置
3. 确认系统时间准确（JWT包含时间戳）

## 📚 相关文档

- [和风天气API文档](https://dev.qweather.com/)
- [JWT标准规范](https://tools.ietf.org/html/rfc7519)
- [Ed25519签名算法](https://tools.ietf.org/html/rfc8032)
- [OpenSSL文档](https://www.openssl.org/docs/)

## 📞 技术支持

如果遇到问题，请：
1. 检查本文档的故障排除部分
2. 查看和风天气官方文档
3. 确认所有配置步骤都已正确完成