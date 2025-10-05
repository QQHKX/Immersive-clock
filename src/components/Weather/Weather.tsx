import React, { useState, useEffect, useCallback } from 'react';
import styles from './Weather.module.css';
import { buildWeatherFlow } from '../../services/weatherService';

// 天气数据接口
export interface WeatherData {
  temperature: string;
  text: string;
  location: string;
  icon: string;
}

/**
 * 天气组件（重构版）
 * 完全使用和风天气 + 高德反编码逻辑。
 */
const Weather: React.FC = () => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<string>('');

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
   * 初始化天气数据（通过和风 + 高德反编码）
   */
  const initializeWeather = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setRefreshStatus('刷新中');
      localStorage.setItem('weather.refreshStatus', '刷新中');

      const result = await buildWeatherFlow();

      if (!result.coords || !result.weather || result.weather.code !== '200' || !result.weather.now) {
        throw new Error(`天气获取失败: ${result.weather?.code || 'unknown'}`);
      }

      const now = result.weather.now;
      const temperature = now?.temp ?? '';
      const text = now?.text ?? '';
      const locationName = result.city || '未知';
      const icon = mapWeatherToIcon(text);

      const address = result.addressInfo?.address || '';
      const ts = Date.now();

      setWeatherData({ temperature, text, location: locationName, icon });
      setRefreshStatus('成功');
      localStorage.setItem('weather.address', address);
      localStorage.setItem('weather.lastSuccessTs', String(ts));
      localStorage.setItem('weather.refreshStatus', '成功');
      // 额外持久化：坐标与全部实时天气字段
      if (result.coords) {
        localStorage.setItem('weather.coords.lat', String(result.coords.lat));
        localStorage.setItem('weather.coords.lon', String(result.coords.lon));
        if (result.coordsSource) {
          localStorage.setItem('weather.coords.source', result.coordsSource);
        }
      }
      if (now) {
        if (now.obsTime) localStorage.setItem('weather.now.obsTime', now.obsTime);
        if (now.text) localStorage.setItem('weather.now.text', now.text);
        if (now.temp != null) localStorage.setItem('weather.now.temp', String(now.temp));
        if (now.feelsLike != null) localStorage.setItem('weather.now.feelsLike', String(now.feelsLike));
        if (now.windDir) localStorage.setItem('weather.now.windDir', now.windDir);
        if (now.windScale != null) localStorage.setItem('weather.now.windScale', String(now.windScale));
        if (now.windSpeed != null) localStorage.setItem('weather.now.windSpeed', String(now.windSpeed));
        if (now.humidity != null) localStorage.setItem('weather.now.humidity', String(now.humidity));
        if (now.pressure != null) localStorage.setItem('weather.now.pressure', String(now.pressure));
        if (now.precip != null) localStorage.setItem('weather.now.precip', String(now.precip));
        if (now.vis != null) localStorage.setItem('weather.now.vis', String(now.vis));
        if (now.cloud != null) localStorage.setItem('weather.now.cloud', String(now.cloud));
        if (now.dew != null) localStorage.setItem('weather.now.dew', String(now.dew));
        if (result.weather?.refer?.sources) localStorage.setItem('weather.refer.sources', (result.weather.refer.sources || []).join(','));
        if (result.weather?.refer?.license) localStorage.setItem('weather.refer.license', (result.weather.refer.license || []).join(','));
      }

      // 广播刷新完成事件
      const event = new CustomEvent('weatherRefreshDone', {
        detail: {
          status: '成功',
          address,
          ts,
          coords: result.coords || null,
          now,
          refer: result.weather?.refer || null,
        },
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('天气初始化失败:', error);
      setError(error instanceof Error ? error.message : '未知错误');
      setRefreshStatus('失败');
      localStorage.setItem('weather.refreshStatus', '失败');
      const event = new CustomEvent('weatherRefreshDone', { detail: { status: '失败', address: localStorage.getItem('weather.address') || '', ts: Date.now() } });
      window.dispatchEvent(event);
    } finally {
      setLoading(false);
    }
  }, []);

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
          loading="lazy"
          decoding="async"
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