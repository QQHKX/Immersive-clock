import React, { useState, useEffect, useCallback } from 'react';
import styles from './Weather.module.css';

// 高德地图天气API配置
const AMAP_API_KEY = import.meta.env.VITE_AMAP_API_KEY || '3b0e54901cc67a554c3574a1daa47f64';
const AMAP_BASE_URL = 'https://restapi.amap.com/v3';

// 天气数据接口
export interface WeatherData {
  temperature: string;
  text: string;
  location: string;
  icon: string;
}

// 地理位置接口
interface LocationData {
  latitude: number;
  longitude: number;
}

/**
 * 天气组件
 * 显示当前位置的实时天气信息，包括温度和天气图标
 */
const Weather: React.FC = () => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取用户地理位置
   * 如果无法获取地理位置，默认使用成都的坐标
   */
  const getCurrentLocation = useCallback((): Promise<LocationData> => {
    return new Promise((resolve) => {
      // 成都的默认坐标
      const defaultLocation: LocationData = {
        latitude: 30.5728,
        longitude: 104.0668
      };

      if (!navigator.geolocation) {
        console.warn('浏览器不支持地理位置，使用成都默认位置');
        resolve(defaultLocation);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.warn('无法获取地理位置，使用成都默认位置:', error);
          resolve(defaultLocation);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5分钟缓存
        }
      );
    });
  }, []);

  /**
   * 调用高德地图API获取天气数据
   */
  const fetchWeatherData = useCallback(async (location: LocationData): Promise<WeatherData> => {
    const { latitude, longitude } = location;
    
    try {
      // 1. 逆地理编码获取adcode
      const regeoUrl = `${AMAP_BASE_URL}/geocode/regeo?location=${longitude},${latitude}&key=${AMAP_API_KEY}`;
      const regeoResponse = await fetch(regeoUrl);
      const regeoData = await regeoResponse.json();

      if (regeoData.status !== '1' || !regeoData.regeocode.addressComponent.adcode) {
        throw new Error('获取adcode失败');
      }
      const adcode = regeoData.regeocode.addressComponent.adcode;

      // 2. 获取天气信息
      const weatherUrl = `${AMAP_BASE_URL}/weather/weatherInfo?city=${adcode}&key=${AMAP_API_KEY}`;
      const weatherResponse = await fetch(weatherUrl);
      const weatherData = await weatherResponse.json();

      if (weatherData.status !== '1' || !weatherData.lives || weatherData.lives.length === 0) {
        throw new Error('获取天气信息失败');
      }

      const weather = weatherData.lives[0];
      return {
        temperature: weather.temperature || '22',
        text: weather.weather || '晴',
        location: weather.city || '未知',
        icon: mapWeatherToIcon(weather.weather || '晴'),
      };
    } catch (error) {
      console.warn('获取天气数据失败，使用模拟数据:', error);
      return {
        temperature: '22',
        text: '晴',
        location: '成都',
        icon: '01d',
      };
    }
  }, []);

  /**
   * 判断当前是否为夜间时间
   * 夜间时间定义为：18:00 - 06:00
   */
  const isNightTime = (): boolean => {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 18 || hour < 6;
  };

  /**
   * 将天气文本映射到图标代码
   * 根据时间自动选择白天或夜间图标
   */
  const mapWeatherToIcon = (weatherText: string): string => {
    // 检查参数是否有效
    if (!weatherText || typeof weatherText !== 'string') {
      return isNightTime() ? '01n' : '01d'; // 默认晴天
    }
    
    const suffix = isNightTime() ? 'n' : 'd';
    
    if (weatherText.includes('晴')) return `01${suffix}`;
    if (weatherText.includes('阴')) return `04${suffix}`;
    if (weatherText.includes('多云')) return `03${suffix}`;
    if (weatherText.includes('云')) return `02${suffix}`;
    if (weatherText.includes('雨')) return `09${suffix}`;
    if (weatherText.includes('雪')) return `13${suffix}`;
    if (weatherText.includes('雾') || weatherText.includes('霾')) return `50${suffix}`;
    if (weatherText.includes('雷')) return `11${suffix}`;
    return `01${suffix}`; // 默认晴天
  };

  /**
   * 获取天气描述的单字简化版本
   */
  const getSimplifiedWeatherText = useCallback((text: string): string => {
    const weatherMap: { [key: string]: string } = {
      '晴': '晴',
      '多云': '云',
      '阴': '阴',
      '小雨': '雨',
      '中雨': '雨',
      '大雨': '雨',
      '暴雨': '雨',
      '雷阵雨': '雷',
      '小雪': '雪',
      '中雪': '雪',
      '大雪': '雪',
      '雾': '雾',
      '霾': '霾',
      '沙尘暴': '沙',
      '浮尘': '尘',
      '扬沙': '沙'
    };
    
    for (const [key, value] of Object.entries(weatherMap)) {
      if (text.includes(key)) {
        return value;
      }
    }
    
    return text.charAt(0) || '晴';
  }, []);

  /**
   * 获取天气图标URL
   */
  const getWeatherIconUrl = useCallback((iconCode: string): string => {
    return `/weather-icons/fill/${iconCode}.svg`;
  }, []);

  /**
   * 初始化天气数据
   */
  const initializeWeather = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const location = await getCurrentLocation();
      const weather = await fetchWeatherData(location);
      
      setWeatherData(weather);
      console.info('✅ 天气数据获取成功');
    } catch (error) {
      console.error('天气初始化失败:', error);
      setError(error instanceof Error ? error.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [getCurrentLocation, fetchWeatherData]);

  /**
   * 组件挂载时初始化天气数据
   */
  useEffect(() => {
    initializeWeather();
    
    // 每30分钟更新一次天气数据
    const interval = setInterval(initializeWeather, 30 * 60 * 1000);
    
    // 监听天气刷新事件
    const handleWeatherRefresh = () => {
      initializeWeather();
    };
    
    window.addEventListener('weatherRefresh', handleWeatherRefresh);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('weatherRefresh', handleWeatherRefresh);
    };
  }, [initializeWeather]);

  // 加载状态
  if (loading) {
    return (
      <div className={styles.weather}>
        <div className={styles.loading}>
          <div className={styles.loadingDot}></div>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error || !weatherData) {
    return (
      <div className={styles.weather}>
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.weather} title={`${weatherData.text} ${weatherData.temperature}°C`}>
      <div className={styles.temperature}>
        {weatherData.temperature}°
      </div>
      <div className={styles.divider}></div>
      <div className={styles.icon}>
        <img 
          src={getWeatherIconUrl(weatherData.icon)} 
          alt={weatherData.text}
          className={styles.weatherIcon}
        />
      </div>
      <div className={styles.weatherText}>
        {getSimplifiedWeatherText(weatherData.text)}
      </div>
    </div>
  );
};

export default Weather;