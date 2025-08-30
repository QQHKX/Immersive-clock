/**
 * 天气组件API调用测试脚本
 * 用于验证天气组件中的JWT token认证逻辑是否正常工作
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * 从.env.local文件加载环境变量
 */
function loadEnvConfig() {
  const envPath = path.join(__dirname, '..', '.env.local');
  
  if (!fs.existsSync(envPath)) {
    console.log('⚠️ .env.local 文件不存在');
    return { apiKey: null, apiHost: null };
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  let apiKey = null;
  let apiHost = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        
        if (key === 'REACT_APP_QWEATHER_API_KEY') {
          apiKey = value;
        } else if (key === 'REACT_APP_QWEATHER_HOST') {
          apiHost = value;
        }
      }
    }
  }
  
  return { apiKey, apiHost };
}

/**
 * 测试天气组件的API调用
 */
async function testWeatherComponentAPI() {
  console.log('🌤️ 测试天气组件API调用\n');
  console.log('=' .repeat(50));
  
  // 加载环境变量
  const config = loadEnvConfig();
  
  const apiKey = config.apiKey;
  const apiHost = config.apiHost;
  
  console.log('📋 配置信息:');
  console.log(`   API Host: ${apiHost || '未配置'}`);
  console.log(`   API Key: ${apiKey ? apiKey.substring(0, 20) + '...' : '未配置'}`);
  
  if (!apiKey || !apiHost) {
    console.log('\n❌ API配置不完整，请检查.env.local文件');
    return;
  }
  
  // 测试位置（北京，与api-test.cjs一致）
  const testCoords = {
    longitude: 116.4074,
    latitude: 39.9042
  };
  
  console.log(`\n🌍 测试位置: 北京 (${testCoords.latitude}, ${testCoords.longitude})`);
  
  try {
    // 构建API URL（不包含key参数，使用Authorization头）
    const apiUrl = `${apiHost}/v7/weather/now?location=${testCoords.longitude},${testCoords.latitude}`;
    
    console.log('\n🚀 发送API请求...');
    
    const result = await makeAPIRequest(apiUrl, apiKey);
    
    if (result.success) {
      console.log('✅ API调用成功');
      
      if (result.data && result.data.code === '200') {
        console.log('✅ 天气数据获取成功');
        
        const weather = result.data.now;
        if (weather) {
          console.log('\n📊 天气信息:');
          console.log(`   温度: ${weather.temp}°C`);
          console.log(`   天气: ${weather.text}`);
          console.log(`   图标代码: ${weather.icon}`);
          console.log(`   湿度: ${weather.humidity}%`);
          console.log(`   风向: ${weather.windDir}`);
          console.log(`   风速: ${weather.windSpeed} km/h`);
        }
      } else {
        console.log(`❌ API返回错误: ${result.data?.code || '未知'} - ${result.data?.msg || '无详细信息'}`);
      }
    } else {
      console.log('❌ API调用失败');
      console.log(`   状态码: ${result.statusCode}`);
      console.log(`   错误: ${result.error}`);
      
      if (result.data) {
        console.log(`   API响应: ${JSON.stringify(result.data, null, 2)}`);
      }
      
      if (result.rawData) {
        console.log(`   原始响应: ${result.rawData}`);
      }
    }
    
  } catch (error) {
    console.log('❌ 测试过程中发生错误:', error.message);
  }
  
  console.log('\n========================================');
  console.log('测试完成！');
}

/**
 * 发送HTTPS请求
 */
function makeAPIRequest(url, apiKey) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'Immersive-Clock/3.3.3',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 10000
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
      
      stream.on('data', (chunk) => {
        data += chunk;
      });
      
      stream.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            success: res.statusCode === 200,
            statusCode: res.statusCode,
            data: jsonData
          });
        } catch (error) {
          resolve({
            success: false,
            statusCode: res.statusCode,
            error: '响应解析失败',
            rawData: data.substring(0, 200)
          });
        }
      });
      
      stream.on('error', (error) => {
        resolve({
          success: false,
          error: `响应流错误: ${error.message}`
        });
      });
    });
    
    req.on('error', (error) => {
      resolve({
        success: false,
        error: `请求错误: ${error.message}`
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: '请求超时'
      });
    });
    
    req.end();
  });
}

// 运行测试
if (require.main === module) {
  testWeatherComponentAPI();
}

module.exports = { testWeatherComponentAPI };