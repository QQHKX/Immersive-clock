/**
 * 和风天气API测试脚本
 * 用于测试API的各种功能，包括JWT认证、API调用和响应验证
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// 测试配置
const TEST_CONFIG = {
  // 从环境变量或配置文件读取
  apiHost: process.env.QWEATHER_HOST || 'https://devapi.qweather.com',
  jwtToken: process.env.QWEATHER_JWT_TOKEN || '',
  
  // 测试用的地理位置（北京）
  testLocation: {
    longitude: 116.4074,
    latitude: 39.9042,
    locationId: '101010100' // 北京的location ID
  },
  
  // 测试的API端点
  endpoints: {
    currentWeather: '/v7/weather/now',
    forecast3d: '/v7/weather/3d',
    forecast7d: '/v7/weather/7d',
    airQuality: '/v7/air/now',
    geoLookup: '/v2/city/lookup'
  },
  
  // 请求超时时间（毫秒）
  timeout: 10000
};

/**
 * 从.env.local文件读取配置
 */
function loadEnvConfig() {
  const envPath = path.join(__dirname, '..', '.env.local');
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        
        if (key === 'REACT_APP_QWEATHER_HOST') {
          TEST_CONFIG.apiHost = value;
        } else if (key === 'REACT_APP_QWEATHER_API_KEY') {
          TEST_CONFIG.jwtToken = value;
        }
      }
    });
    
    console.log('✅ 已从 .env.local 加载配置');
  } else {
    console.log('⚠️  未找到 .env.local 文件，使用默认配置');
  }
}

/**
 * 验证JWT Token格式
 */
function validateJWTFormat(token) {
  if (!token) {
    return { valid: false, error: 'JWT Token 为空' };
  }
  
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'JWT Token 格式错误，应包含3个部分' };
  }
  
  try {
    // 解析Header
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (header.alg !== 'EdDSA') {
      return { valid: false, error: `算法错误，期望 EdDSA，实际 ${header.alg}` };
    }
    
    // 解析Payload
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const now = Math.floor(Date.now() / 1000);
    
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'JWT Token 已过期' };
    }
    
    return { 
      valid: true, 
      header, 
      payload,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toLocaleString() : '无过期时间'
    };
  } catch (error) {
    return { valid: false, error: `JWT 解析失败: ${error.message}` };
  }
}

/**
 * 发送HTTP请求
 */
function makeRequest(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'Immersive-Clock-API-Test/1.0',
        ...headers
      },
      timeout: TEST_CONFIG.timeout
    };
    
    const req = https.request(options, (res) => {
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
      
      let data = '';
      
      stream.on('data', (chunk) => {
        data += chunk.toString('utf8');
      });
      
      stream.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data,
            parseError: error.message
          });
        }
      });
      
      stream.on('error', (error) => {
        reject(new Error(`响应解压失败: ${error.message}`));
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    
    req.end();
  });
}

/**
 * 测试单个API端点
 */
async function testEndpoint(name, endpoint, params = {}) {
  console.log(`\n🧪 测试 ${name}...`);
  
  try {
    // 构建URL
    const url = new URL(endpoint, TEST_CONFIG.apiHost);
    Object.keys(params).forEach(key => {
      url.searchParams.append(key, params[key]);
    });
    
    console.log(`   请求URL: ${url.toString()}`);
    
    // 发送请求
    const response = await makeRequest(url.toString(), {
      'Authorization': `Bearer ${TEST_CONFIG.jwtToken}`
    });
    
    console.log(`   状态码: ${response.statusCode}`);
    
    if (response.statusCode === 200) {
      if (response.data && response.data.code === '200') {
        console.log(`   ✅ ${name} 测试成功`);
        console.log(`   📊 数据预览:`, JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
        return { success: true, data: response.data };
      } else {
        console.log(`   ❌ API返回错误: ${response.data?.code} - ${response.data?.msg || '未知错误'}`);
        return { success: false, error: response.data };
      }
    } else {
      console.log(`   ❌ HTTP错误: ${response.statusCode}`);
      console.log(`   错误详情:`, response.data);
      return { success: false, error: response.data };
    }
  } catch (error) {
    console.log(`   ❌ 请求失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 测试地理位置查询
 */
async function testGeoLookup() {
  return await testEndpoint(
    '地理位置查询',
    TEST_CONFIG.endpoints.geoLookup,
    {
      location: '北京',
      key: TEST_CONFIG.jwtToken
    }
  );
}

/**
 * 测试实时天气
 */
async function testCurrentWeather() {
  return await testEndpoint(
    '实时天气',
    TEST_CONFIG.endpoints.currentWeather,
    {
      location: `${TEST_CONFIG.testLocation.longitude},${TEST_CONFIG.testLocation.latitude}`,
      key: TEST_CONFIG.jwtToken
    }
  );
}

/**
 * 测试3天天气预报
 */
async function testForecast3d() {
  return await testEndpoint(
    '3天天气预报',
    TEST_CONFIG.endpoints.forecast3d,
    {
      location: TEST_CONFIG.testLocation.locationId,
      key: TEST_CONFIG.jwtToken
    }
  );
}

/**
 * 测试7天天气预报
 */
async function testForecast7d() {
  return await testEndpoint(
    '7天天气预报',
    TEST_CONFIG.endpoints.forecast7d,
    {
      location: TEST_CONFIG.testLocation.locationId,
      key: TEST_CONFIG.jwtToken
    }
  );
}

/**
 * 测试空气质量
 */
async function testAirQuality() {
  return await testEndpoint(
    '空气质量',
    TEST_CONFIG.endpoints.airQuality,
    {
      location: TEST_CONFIG.testLocation.locationId,
      key: TEST_CONFIG.jwtToken
    }
  );
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('🚀 开始和风天气API功能测试\n');
  console.log('=' .repeat(50));
  
  // 加载配置
  loadEnvConfig();
  
  // 验证配置
  console.log('\n📋 配置验证:');
  console.log(`   API Host: ${TEST_CONFIG.apiHost}`);
  console.log(`   JWT Token: ${TEST_CONFIG.jwtToken ? TEST_CONFIG.jwtToken.substring(0, 20) + '...' : '未配置'}`);
  
  // 验证JWT Token
  const jwtValidation = validateJWTFormat(TEST_CONFIG.jwtToken);
  if (!jwtValidation.valid) {
    console.log(`   ❌ JWT Token 验证失败: ${jwtValidation.error}`);
    console.log('\n请检查 .env.local 文件中的 REACT_APP_QWEATHER_API_KEY 配置');
    return;
  }
  
  console.log(`   ✅ JWT Token 格式正确`);
  console.log(`   📅 过期时间: ${jwtValidation.expiresAt}`);
  
  // 测试结果统计
  const results = {
    total: 0,
    success: 0,
    failed: 0,
    details: []
  };
  
  // 执行各项测试
  const tests = [
    { name: '地理位置查询', func: testGeoLookup },
    { name: '实时天气', func: testCurrentWeather },
    { name: '3天天气预报', func: testForecast3d },
    { name: '7天天气预报', func: testForecast7d },
    { name: '空气质量', func: testAirQuality }
  ];
  
  for (const test of tests) {
    const result = await test.func();
    results.total++;
    
    if (result.success) {
      results.success++;
    } else {
      results.failed++;
    }
    
    results.details.push({
      name: test.name,
      success: result.success,
      error: result.error
    });
    
    // 测试间隔，避免请求过于频繁
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 输出测试总结
  console.log('\n' + '=' .repeat(50));
  console.log('📊 测试总结:');
  console.log(`   总测试数: ${results.total}`);
  console.log(`   成功: ${results.success}`);
  console.log(`   失败: ${results.failed}`);
  console.log(`   成功率: ${((results.success / results.total) * 100).toFixed(1)}%`);
  
  if (results.failed > 0) {
    console.log('\n❌ 失败的测试:');
    results.details.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.name}: ${typeof r.error === 'string' ? r.error : JSON.stringify(r.error)}`);
    });
  }
  
  console.log('\n🎉 测试完成!');
  
  if (results.success === results.total) {
    console.log('✅ 所有API功能正常，可以正常使用!');
  } else {
    console.log('⚠️  部分API功能异常，请检查配置和网络连接');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testCurrentWeather,
  testForecast3d,
  testForecast7d,
  testAirQuality,
  testGeoLookup,
  validateJWTFormat
};