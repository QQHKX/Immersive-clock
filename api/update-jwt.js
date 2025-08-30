// JWT Token 自动更新 API
import crypto from 'crypto';

/**
 * 生成 Ed25519 JWT Token
 * @param {string} credentialId - 凭据ID
 * @param {string} projectId - 项目ID
 * @param {string} privateKey - 私钥内容
 * @param {number} expirationTime - 有效期（秒）
 * @returns {string} JWT Token
 */
function generateJWT(credentialId, projectId, privateKey, expirationTime = 86400) {
  const now = Math.floor(Date.now() / 1000);
  
  // JWT Header
  const header = {
    alg: 'EdDSA',
    kid: credentialId
  };
  
  // JWT Payload
  const payload = {
    sub: projectId,
    iat: now,
    exp: now + expirationTime
  };
  
  // Base64URL 编码
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  // 创建签名
  const message = `${headerB64}.${payloadB64}`;
  const privateKeyObj = crypto.createPrivateKey({
    key: privateKey,
    format: 'pem',
    type: 'pkcs8'
  });
  
  const signature = crypto.sign(null, Buffer.from(message), privateKeyObj);
  const signatureB64 = signature.toString('base64url');
  
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Vercel Serverless Function 处理器
 * 用于自动更新和风天气 JWT Token
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
export default async function handler(req, res) {
  // 验证请求方法
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // 验证授权
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.UPDATE_JWT_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    // 从环境变量获取配置
    const credentialId = process.env.QWEATHER_CREDENTIAL_ID;
    const projectId = process.env.QWEATHER_PROJECT_ID;
    const privateKey = process.env.QWEATHER_PRIVATE_KEY;
    
    if (!credentialId || !projectId || !privateKey) {
      return res.status(500).json({ 
        error: 'Missing configuration',
        details: {
          hasCredentialId: !!credentialId,
          hasProjectId: !!projectId,
          hasPrivateKey: !!privateKey
        }
      });
    }
    
    // 生成新的 JWT Token
    const newToken = generateJWT(credentialId, projectId, privateKey);
    
    // 记录成功日志
    console.log(`JWT Token updated successfully at ${new Date().toISOString()}`);
    console.log(`Token expires at: ${new Date(Date.now() + 86400 * 1000).toISOString()}`);
    
    // 触发重新部署（通过 Vercel Deploy Hook）
    if (process.env.VERCEL_DEPLOY_HOOK) {
      try {
        const deployResponse = await fetch(process.env.VERCEL_DEPLOY_HOOK, { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (deployResponse.ok) {
          console.log('Vercel deployment triggered successfully');
        } else {
          console.warn('Failed to trigger Vercel deployment:', deployResponse.status);
        }
      } catch (deployError) {
        console.error('Error triggering deployment:', deployError);
      }
    }
    
    return res.status(200).json({
      success: true,
      message: 'JWT token updated successfully',
      token: newToken,
      credentialId: credentialId,
      projectId: projectId,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(),
      deploymentTriggered: !!process.env.VERCEL_DEPLOY_HOOK
    });
    
  } catch (error) {
    console.error('JWT generation failed:', error);
    return res.status(500).json({ 
      error: 'JWT generation failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}