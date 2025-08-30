# 和风天气API JWT认证配置指南

## 概述

和风天气API使用JWT（JSON Web Token）进行身份认证，这比传统的API Key方式更加安全。本文档将指导您如何正确配置JWT认证。

## JWT认证原理

和风天气使用Ed25519算法进行JWT签名，包含三个部分：
- **Header**：包含算法类型和凭据ID
- **Payload**：包含项目ID、签发时间和过期时间
- **Signature**：使用Ed25519私钥对Header和Payload进行签名

## 配置步骤

### 1. 生成Ed25519密钥对

使用OpenSSL生成密钥对：

```bash
# 生成私钥和公钥
openssl genpkey -algorithm ED25519 -out ed25519-private.pem \
&& openssl pkey -pubout -in ed25519-private.pem > ed25519-public.pem
```

### 2. 在和风天气控制台配置公钥

1. 前往 [和风天气控制台](https://console.qweather.com/)
2. 进入项目管理
3. 选择您的项目
4. 点击"添加凭据"
5. 选择"JSON Web Token"认证方式
6. 上传公钥内容
7. 记录凭据ID（kid）和项目ID（sub）

### 3. 生成JWT Token

您需要使用私钥生成JWT token，包含以下信息：

**Header:**
```json
{
  "alg": "EdDSA",
  "kid": "您的凭据ID"
}
```

**Payload:**
```json
{
  "sub": "您的项目ID",
  "iat": 当前时间戳,
  "exp": 过期时间戳
}
```

### 4. 更新环境变量

在 `.env.local` 文件中配置：

```env
# 和风天气API配置
REACT_APP_QWEATHER_API_KEY=完整的JWT_token_字符串
REACT_APP_QWEATHER_HOST=https://your-host.qweatherapi.com/v7
```

## 注意事项

1. **安全性**：私钥必须妥善保管，不要提交到版本控制系统
2. **过期时间**：JWT token有效期最长24小时，需要定期更新
3. **时间同步**：确保服务器时间准确，建议iat设置为当前时间前30秒
4. **环境变量**：JWT token应该通过环境变量传递，不要硬编码

## 代码示例

当前Weather组件已配置为接收完整的JWT token：

```typescript
// 从环境变量读取JWT token
const QWEATHER_API_KEY = process.env.REACT_APP_QWEATHER_API_KEY;

// 在API请求中使用
headers: {
  'Authorization': `Bearer ${QWEATHER_API_KEY}`,
  'Content-Type': 'application/json'
}
```

## 故障排除

- **401错误**：检查JWT token是否正确生成和配置
- **403错误**：检查项目ID和凭据ID是否匹配
- **过期错误**：检查JWT token是否已过期，需要重新生成

## 参考资源

- [和风天气JWT认证文档](https://dev.qweather.com/docs/configuration/authentication/#json-web-token)
- [JWT.io - JWT调试工具](https://jwt.io/)
- [OpenSSL文档](https://www.openssl.org/docs/)