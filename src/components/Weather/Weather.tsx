import React, { useState, useEffect, useCallback } from "react";

import { buildWeatherFlow, fetchWeatherAlertsByCoords, fetchMinutelyPrecip } from "../../services/weatherService";
import { logger } from "../../utils/logger";
import { useAppState } from "../../contexts/AppContext";

import styles from "./Weather.module.css";

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
  const { study } = useAppState();

  /**
   * 将天气文本映射到图标代码
   * 根据时间自动选择白天或夜间图标
   */
  const mapWeatherToIcon = useCallback((weatherText: string): string => {
    const now = new Date();
    const suffix = now.getHours() >= 18 || now.getHours() < 6 ? "n" : "d";
    if (!weatherText || typeof weatherText !== "string") {
      return `01${suffix}`; // 默认晴天
    }

    if (weatherText.includes("晴")) return `01${suffix}`;
    if (weatherText.includes("阴")) return `04${suffix}`;
    if (weatherText.includes("多云")) return `03${suffix}`;
    if (weatherText.includes("云")) return `02${suffix}`;
    if (weatherText.includes("雨")) return `09${suffix}`;
    if (weatherText.includes("雪")) return `13${suffix}`;
    if (weatherText.includes("雾") || weatherText.includes("霾")) return `50${suffix}`;
    if (weatherText.includes("雷")) return `11${suffix}`;
    return `01${suffix}`; // 默认晴天
  }, []);

  /**
   * 获取天气描述的单字简化版本
   */
  const getSimplifiedWeatherText = useCallback((text: string): string => {
    const weatherMap: { [key: string]: string } = {
      晴: "晴",
      多云: "云",
      阴: "阴",
      小雨: "雨",
      中雨: "雨",
      大雨: "雨",
      暴雨: "雨",
      雷阵雨: "雷",
      小雪: "雪",
      中雪: "雪",
      大雪: "雪",
      雾: "雾",
      霾: "霾",
      沙尘暴: "沙",
      浮尘: "尘",
      扬沙: "沙",
    };

    for (const [key, value] of Object.entries(weatherMap)) {
      if (text.includes(key)) {
        return value;
      }
    }

    return text.charAt(0) || "晴";
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

      localStorage.setItem("weather.refreshStatus", "刷新中");

      const result = await buildWeatherFlow();

      if (
        !result.coords ||
        !result.weather ||
        result.weather.code !== "200" ||
        !result.weather.now
      ) {
        throw new Error(`天气获取失败: ${result.weather?.code || "unknown"}`);
      }

      const now = result.weather.now;
      const temperature = now?.temp ?? "";
      const text = now?.text ?? "";
      const locationName = result.city || "未知";
      const icon = mapWeatherToIcon(text);

      const address = result.addressInfo?.address || "";
      const ts = Date.now();

      setWeatherData({ temperature, text, location: locationName, icon });

      localStorage.setItem("weather.address", address);
      localStorage.setItem("weather.lastSuccessTs", String(ts));
      localStorage.setItem("weather.refreshStatus", "成功");
      // 额外持久化：坐标与全部实时天气字段
      if (result.coords) {
        localStorage.setItem("weather.coords.lat", String(result.coords.lat));
        localStorage.setItem("weather.coords.lon", String(result.coords.lon));
        if (result.coordsSource) {
          localStorage.setItem("weather.coords.source", result.coordsSource);
        }
      }
      if (now) {
        if (now.obsTime) localStorage.setItem("weather.now.obsTime", now.obsTime);
        if (now.text) localStorage.setItem("weather.now.text", now.text);
        if (now.temp != null) localStorage.setItem("weather.now.temp", String(now.temp));
        if (now.feelsLike != null)
          localStorage.setItem("weather.now.feelsLike", String(now.feelsLike));
        if (now.windDir) localStorage.setItem("weather.now.windDir", now.windDir);
        if (now.windScale != null)
          localStorage.setItem("weather.now.windScale", String(now.windScale));
        if (now.windSpeed != null)
          localStorage.setItem("weather.now.windSpeed", String(now.windSpeed));
        if (now.humidity != null)
          localStorage.setItem("weather.now.humidity", String(now.humidity));
        if (now.pressure != null)
          localStorage.setItem("weather.now.pressure", String(now.pressure));
        if (now.precip != null) localStorage.setItem("weather.now.precip", String(now.precip));
        if (now.vis != null) localStorage.setItem("weather.now.vis", String(now.vis));
        if (now.cloud != null) localStorage.setItem("weather.now.cloud", String(now.cloud));
        if (now.dew != null) localStorage.setItem("weather.now.dew", String(now.dew));
        if (result.weather?.refer?.sources)
          localStorage.setItem(
            "weather.refer.sources",
            (result.weather.refer.sources || []).join(",")
          );
        if (result.weather?.refer?.license)
          localStorage.setItem(
            "weather.refer.license",
            (result.weather.refer.license || []).join(",")
          );
      }

      // 广播刷新完成事件
      const event = new CustomEvent("weatherRefreshDone", {
        detail: {
          status: "成功",
          address,
          ts,
          coords: result.coords || null,
          now,
          refer: result.weather?.refer || null,
        },
      });
      window.dispatchEvent(event);
    } catch (error) {
      logger.error("天气初始化失败:", error);
      setError(error instanceof Error ? error.message : "未知错误");

      localStorage.setItem("weather.refreshStatus", "失败");
      const event = new CustomEvent("weatherRefreshDone", {
        detail: {
          status: "失败",
          address: localStorage.getItem("weather.address") || "",
          ts: Date.now(),
        },
      });
      window.dispatchEvent(event);
    } finally {
      setLoading(false);
    }
  }, [mapWeatherToIcon]);

  /**
   * 处理天气预警与降雨提醒
   */
  const handleAlertsAndPrecip = useCallback(async (coords?: { lat: number; lon: number } | null) => {
    if (!coords || !study?.messagePopupEnabled) return;
    const locationParam = `${coords.lon},${coords.lat}`;
    try {
      if (study.weatherAlertEnabled) {
        const alertResp = await fetchWeatherAlertsByCoords(coords.lat, coords.lon);
        if (!alertResp.error && alertResp.alerts && alertResp.alerts.length > 0 && !alertResp.metadata?.zeroResult) {
          const first = alertResp.alerts[0];
          const lastTag = localStorage.getItem("weather.alert.lastTag");
          if (alertResp.metadata?.tag && alertResp.metadata.tag !== lastTag) {
            localStorage.setItem("weather.alert.lastTag", alertResp.metadata.tag);
            const ev = new CustomEvent("messagePopup:open", {
              detail: {
                type: "weatherAlert",
                title: first.headline || (first.eventType?.name ? `${first.eventType.name}预警` : "天气预警"),
                message: first.description || "请注意当前天气预警信息。",
              },
            });
            window.dispatchEvent(ev);
          }
        }
      }
    } catch (e) {
      logger.warn("天气预警处理失败:", e);
    }

    try {
      if (study.minutelyPrecipEnabled) {
        const minResp = await fetchMinutelyPrecip(locationParam);
        if (!minResp.error && minResp.code === "200") {
          const lastUpdate = localStorage.getItem("weather.minutely.lastUpdateTime");
          if (minResp.updateTime && minResp.updateTime !== lastUpdate) {
            localStorage.setItem("weather.minutely.lastUpdateTime", minResp.updateTime);
            const hasRainSoon = (minResp.minutely || []).some((m) => {
              const p = m.precip ? parseFloat(m.precip) : 0;
              return Number.isFinite(p) && p > 0;
            });
            if (hasRainSoon) {
              const ev = new CustomEvent("messagePopup:open", {
                detail: {
                  type: "weatherAlert",
                  title: "降雨提醒",
                  message: minResp.summary || "未来两小时可能有降雨，请注意出行。",
                },
              });
              window.dispatchEvent(ev);
            }
          }
        }
      }
    } catch (e) {
      logger.warn("分钟级降水处理失败:", e);
    }
  }, [study]);

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

    window.addEventListener("weatherRefresh", handleWeatherRefresh);
    const onDone = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      handleAlertsAndPrecip(detail.coords || null);
    };
    window.addEventListener("weatherRefreshDone", onDone as EventListener);

    return () => {
      clearInterval(interval);
      window.removeEventListener("weatherRefresh", handleWeatherRefresh);
      window.removeEventListener("weatherRefreshDone", onDone as EventListener);
    };
  }, [initializeWeather, handleAlertsAndPrecip]);

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
      <div className={styles.temperature}>{weatherData.temperature}°</div>
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
      <div className={styles.weatherText}>{getSimplifiedWeatherText(weatherData.text)}</div>
    </div>
  );
};

export default Weather;
