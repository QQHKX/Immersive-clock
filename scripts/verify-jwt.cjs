/**
 * 和风天气JWT Token验证工具
 * 用于验证生成的JWT token是否符合和风天气API要求
 */

const https = require('https');
const http = require('http');
const url = require('url');
const zlib = require('zlib');

/**
 * 验证配置
 */
const VERIFY_CONFIG = {
  // 测试用的API端点（根据官方文档格式）
  testEndpoint: '/v7/weather/now',
  // 测试位置（北京坐标，格式：经度,纬度）
  testLocation: '116.41,39.90',
  // API主机（专用API Host）
  apiHost: 'nn3yfpy58r.re.qweatherapi.com'
};

/**
 * 解析JWT token
 * @param {string} token - JWT token
 * @returns {Object} 解析后的JWT信息
 */
function parseJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('JWT格式错误：应包含3个部分（Header.Payload.Signature）');
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    
    // 解码Header
    const header = JSON.parse(Buffer.from(headerB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    
    // 解码Payload
    const payload = JSON.parse(Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    
    return {
      header,
      payload,
      signature: signatureB64,
      isValid: true
    };
  } catch (error) {
    return {
      isValid: false,
      error: error.message
    };
  }
}

/**
 * 验证JWT格式和内容
 * @param {string} token - JWT token
 * @returns {Object} 验证结果
 */
function validateJWTFormat(token) {
  console.log('🔍 验证JWT格式和内容...');
  
  const parsed = parseJWT(token);
  
  if (!parsed.isValid) {
    return {
      isValid: false,
      errors: [parsed.error]
    };
  }

  const errors = [];
  const warnings = [];
  
  // 验证Header
  const { header, payload } = parsed;
  
  if (header.alg !== 'EdDSA') {
    errors.push('Header.alg 必须为 "EdDSA"');
  }
  
  if (!header.kid || header.kid === 'YOUR_CREDENTIAL_ID') {
    errors.push('Header.kid 必须设置为有效的凭据ID');
  }
  
  // 验证Payload
  if (!payload.sub || payload.sub === 'YOUR_PROJECT_ID') {
    errors.push('Payload.sub 必须设置为有效的项目ID');
  }
  
  if (!payload.iat || typeof payload.iat !== 'number') {
    errors.push('Payload.iat 必须为有效的UNIX时间戳');
  }
  
  if (!payload.exp || typeof payload.exp !== 'number') {
    errors.push('Payload.exp 必须为有效的UNIX时间戳');
  }
  
  if (payload.iat && payload.exp) {
    const now = Math.floor(Date.now() / 1000);
    
    if (payload.exp <= now) {
      errors.push(`JWT已过期：过期时间 ${new Date(payload.exp * 1000).toLocaleString('zh-CN')}`);
    }
    
    if (payload.iat > now + 60) {
      warnings.push('JWT签发时间似乎在未来，请检查系统时间');
    }
    
    const duration = payload.exp - payload.iat;
    if (duration > 86400) {
      warnings.push('JWT有效期超过24小时，可能被API拒绝');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    header,
    payload
  };
}

/**
 * 测试JWT token是否能正常调用API
 * @param {string} token - JWT token
 * @returns {Promise<Object>} 测试结果
 */
function testAPICall(token) {
  return new Promise((resolve) => {
    console.log('🌐 测试API调用...');
    
    const apiUrl = `https://${VERIFY_CONFIG.apiHost}${VERIFY_CONFIG.testEndpoint}?location=${VERIFY_CONFIG.testLocation}&key=${token}`;
    const parsedUrl = url.parse(apiUrl);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'Immersive-Clock/1.0'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      let stream = res;
      
      // 处理压缩响应
      const encoding = res.headers['content-encoding'];
      if (encoding === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      } else if (encoding === 'br') {
        stream = res.pipe(zlib.createBrotliDecompress());
      }
      
      stream.setEncoding('utf8');
      
      stream.on('data', (chunk) => {
        data += chunk;
      });
      
      stream.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            success: res.statusCode === 200,
            statusCode: res.statusCode,
            response,
            rawData: data
          });
        } catch (error) {
          resolve({
            success: false,
            statusCode: res.statusCode,
            error: '响应解析失败',
            rawData: data
          });
        }
      });
      
      stream.on('error', (error) => {
        resolve({
          success: false,
          statusCode: res.statusCode,
          error: `解压错误: ${error.message}`,
          rawData: data
        });
      });
    });
    
    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message
      });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        success: false,
        error: '请求超时'
      });
    });
    
    req.end();
  });
}

/**
 * 主验证函数
 * @param {string} token - 要验证的JWT token
 */
async function verifyJWT(token) {
  console.log('\n🔐 和风天气JWT Token验证工具');
  console.log('========================================\n');
  
  if (!token) {
    console.log('❌ 错误：未提供JWT token');
    console.log('\n使用方法：');
    console.log('  node verify-jwt.js "your-jwt-token-here"');
    console.log('  或者修改脚本中的token变量');
    return;
  }
  
  // 1. 验证JWT格式
  const formatResult = validateJWTFormat(token);
  
  console.log('📋 JWT格式验证结果:');
  if (formatResult.isValid) {
    console.log('✅ JWT格式正确');
    console.log(`   凭据ID: ${formatResult.header.kid}`);
    console.log(`   项目ID: ${formatResult.payload.sub}`);
    console.log(`   签发时间: ${new Date(formatResult.payload.iat * 1000).toLocaleString('zh-CN')}`);
    console.log(`   过期时间: ${new Date(formatResult.payload.exp * 1000).toLocaleString('zh-CN')}`);
    
    if (formatResult.warnings.length > 0) {
      console.log('\n⚠️ 警告:');
      formatResult.warnings.forEach(warning => console.log(`   - ${warning}`));
    }
  } else {
    console.log('❌ JWT格式错误:');
    formatResult.errors.forEach(error => console.log(`   - ${error}`));
    return;
  }
  
  // 2. 测试API调用
  console.log('\n🌐 API调用测试:');
  const apiResult = await testAPICall(token);
  
  if (apiResult.success) {
    console.log('✅ API调用成功');
    if (apiResult.response && apiResult.response.code === '200') {
      console.log('✅ 和风天气API响应正常');
      if (apiResult.response.now) {
        console.log(`   测试位置天气: ${apiResult.response.now.temp}°C, ${apiResult.response.now.text}`);
      }
    } else {
      console.log(`⚠️ API返回错误代码: ${apiResult.response?.code || '未知'}`);
      console.log(`   错误信息: ${apiResult.response?.msg || '无详细信息'}`);
    }
  } else {
    console.log('❌ API调用失败');
    console.log(`   状态码: ${apiResult.statusCode || '无'}`);
    console.log(`   错误: ${apiResult.error || '未知错误'}`);
    
    if (apiResult.rawData) {
      console.log(`   响应数据: ${apiResult.rawData.substring(0, 200)}...`);
    }
  }
  
  console.log('\n========================================');
  console.log('验证完成！');
}

/**
 * 命令行入口
 */
function main() {
  const args = process.argv.slice(2);
  let token = args[0];
  
  // 如果没有提供token，尝试从生成的文件中读取
  if (!token) {
    try {
      const fs = require('fs');
      const tokenFile = './qweather-jwt-token.txt';
      if (fs.existsSync(tokenFile)) {
        const content = fs.readFileSync(tokenFile, 'utf8');
        const match = content.match(/JWT Token:\s*([\w\-_.]+)/i);
        if (match) {
          token = match[1];
          console.log('📁 从 qweather-jwt-token.txt 读取到JWT token');
        }
      }
    } catch (error) {
      // 忽略文件读取错误
    }
  }
  
  verifyJWT(token);
}

if (require.main === module) {
  main();
}

module.exports = {
  verifyJWT,
  parseJWT,
  validateJWTFormat,
  testAPICall
};