/**
 * 和风天气API JWT Token生成工具
 * 根据和风天气官方文档生成符合要求的JWT token
 * 文档：https://dev.qweather.com/docs/configuration/authentication/
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * 读取JWT生成配置
 * 从jwt-config.json文件读取配置信息
 */
function loadConfig() {
  const configPath = './jwt-config.json';
  
  if (!fs.existsSync(configPath)) {
    throw new Error(`配置文件不存在: ${configPath}`);
  }
  
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    // 转换expirationTime为秒数
    if (typeof config.expirationTime === 'string') {
      const timeStr = config.expirationTime.toLowerCase();
      if (timeStr.endsWith('d')) {
        config.expirationTime = parseInt(timeStr) * 24 * 3600;
      } else if (timeStr.endsWith('h')) {
        config.expirationTime = parseInt(timeStr) * 3600;
      } else if (timeStr.endsWith('m')) {
        config.expirationTime = parseInt(timeStr) * 60;
      } else {
        config.expirationTime = parseInt(timeStr);
      }
    }
    
    return config;
  } catch (error) {
    throw new Error(`读取配置文件失败: ${error.message}`);
  }
}

// 默认配置（用于向后兼容）
const DEFAULT_CONFIG = {
  credentialId: 'YOUR_CREDENTIAL_ID',
  projectId: 'YOUR_PROJECT_ID',
  privateKeyPath: './ed25519-private.pem',
  expirationTime: 3600
};

/**
 * Base64URL编码函数
 * @param {Buffer} buffer - 要编码的数据
 * @returns {string} Base64URL编码的字符串
 */
function base64UrlEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * 读取Ed25519私钥
 * @param {string} keyPath - 私钥文件路径
 * @returns {string} 私钥内容
 */
function readPrivateKey(keyPath) {
  try {
    const fullPath = path.resolve(keyPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`私钥文件不存在: ${fullPath}`);
    }
    return fs.readFileSync(fullPath, 'utf8');
  } catch (error) {
    throw new Error(`读取私钥失败: ${error.message}`);
  }
}

/**
 * 生成JWT Header
 * @param {string} credentialId - 凭据ID
 * @returns {string} Base64URL编码的Header
 */
function generateHeader(credentialId) {
  const header = {
    alg: 'EdDSA',
    kid: credentialId
  };
  
  const headerJson = JSON.stringify(header);
  return base64UrlEncode(Buffer.from(headerJson));
}

/**
 * 生成JWT Payload
 * @param {string} projectId - 项目ID
 * @param {number} expirationTime - 有效期（秒）
 * @returns {string} Base64URL编码的Payload
 */
function generatePayload(projectId, expirationTime) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: projectId,
    iat: now - 30, // 提前30秒，防止时间误差
    exp: now + expirationTime
  };
  
  const payloadJson = JSON.stringify(payload);
  return base64UrlEncode(Buffer.from(payloadJson));
}

/**
 * 使用Ed25519私钥生成签名
 * @param {string} data - 要签名的数据
 * @param {string} privateKey - Ed25519私钥
 * @returns {string} Base64URL编码的签名
 */
function generateSignature(data, privateKey) {
  try {
    // 使用crypto.sign方法直接签名
    const signature = crypto.sign(null, Buffer.from(data), {
      key: privateKey,
      format: 'pem',
      type: 'pkcs8'
    });
    return base64UrlEncode(signature);
  } catch (error) {
    throw new Error(`签名生成失败: ${error.message}`);
  }
}

/**
 * 生成完整的JWT token
 * @param {Object} config - 配置对象
 * @returns {string} 完整的JWT token
 */
function generateJWT(config) {
  console.log('🔐 开始生成和风天气JWT token...');
  
  // 验证配置
  if (!config.credentialId || config.credentialId === 'YOUR_CREDENTIAL_ID') {
    throw new Error('请配置有效的凭据ID (credentialId)');
  }
  
  if (!config.projectId || config.projectId === 'YOUR_PROJECT_ID') {
    throw new Error('请配置有效的项目ID (projectId)');
  }
  
  // 读取私钥
  console.log('📖 读取Ed25519私钥...');
  const privateKey = readPrivateKey(config.privateKeyPath);
  
  // 生成Header
  console.log('🏗️ 生成JWT Header...');
  const header = generateHeader(config.credentialId);
  
  // 生成Payload
  console.log('📦 生成JWT Payload...');
  const payload = generatePayload(config.projectId, config.expirationTime);
  
  // 生成签名
  console.log('✍️ 生成Ed25519签名...');
  const data = `${header}.${payload}`;
  const signature = generateSignature(data, privateKey);
  
  // 组合完整的JWT
  const jwt = `${header}.${payload}.${signature}`;
  
  console.log('✅ JWT token生成成功!');
  console.log('📋 Token信息:');
  console.log(`   凭据ID: ${config.credentialId}`);
  console.log(`   项目ID: ${config.projectId}`);
  console.log(`   有效期: ${config.expirationTime}秒`);
  console.log(`   过期时间: ${new Date((Math.floor(Date.now() / 1000) + config.expirationTime) * 1000).toLocaleString()}`);
  console.log('');
  console.log('🎯 生成的JWT Token:');
  console.log(jwt);
  console.log('');
  console.log('💡 使用方法:');
  console.log('将上述JWT token复制到.env.local文件中的REACT_APP_QWEATHER_API_KEY变量');
  
  // 保存JWT token到文件
  const tokenFilePath = './qweather-jwt-token.txt';
  const tokenInfo = `和风天气 JWT Token\n生成时间: ${new Date().toLocaleString('zh-CN')}\n凭据ID: ${config.credentialId}\n项目ID: ${config.projectId}\n有效期: ${config.expirationTime}秒\n过期时间: ${new Date((Math.floor(Date.now() / 1000) + config.expirationTime) * 1000).toLocaleString('zh-CN')}\n\nJWT Token:\n${jwt}\n\n使用方法:\n将上述JWT token复制到.env.local文件中的REACT_APP_QWEATHER_API_KEY变量`;
  
  try {
    fs.writeFileSync(tokenFilePath, tokenInfo, 'utf8');
    console.log(`💾 JWT token已保存到: ${tokenFilePath}`);
  } catch (error) {
    console.log('⚠️ 保存token文件失败:', error.message);
  }
  
  return jwt;
}

/**
 * 生成Ed25519密钥对的说明
 */
function showKeyGenerationInstructions() {
  console.log('🔑 Ed25519密钥对生成说明:');
  console.log('');
  console.log('如果您还没有Ed25519密钥对，请按以下步骤生成:');
  console.log('');
  console.log('1. 安装OpenSSL (Windows用户推荐使用winget):');
  console.log('   winget install OpenSSL.Light');
  console.log('');
  console.log('2. 生成密钥对:');
  console.log('   openssl genpkey -algorithm ED25519 -out ed25519-private.pem \\');
  console.log('   && openssl pkey -pubout -in ed25519-private.pem > ed25519-public.pem');
  console.log('');
  console.log('3. 将公钥内容上传到和风天气控制台');
  console.log('4. 获取凭据ID和项目ID');
  console.log('5. 修改本脚本中的CONFIG配置');
  console.log('');
}

/**
 * 主函数
 */
function main() {
  try {
    // 加载配置
    console.log('📖 读取配置文件...');
    const config = loadConfig();
    
    // 检查是否需要显示密钥生成说明
    if (!fs.existsSync(config.privateKeyPath)) {
      console.log('❌ 未找到私钥文件:', config.privateKeyPath);
      showKeyGenerationInstructions();
      return;
    }
    
    // 生成JWT
    const jwt = generateJWT(config);
    
    // 保存到文件
    const outputPath = './qweather-jwt-token.txt';
    fs.writeFileSync(outputPath, jwt);
    console.log(`💾 JWT token已保存到: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ 生成JWT失败:', error.message);
    console.log('');
    showKeyGenerationInstructions();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  generateJWT,
  loadConfig,
  DEFAULT_CONFIG
};