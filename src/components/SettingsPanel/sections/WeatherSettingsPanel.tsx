import React, { useCallback, useEffect, useState } from "react";

import { getWeatherCache, clearWeatherCache } from "../../../utils/weatherStorage";
import { FormSection, FormButton, FormButtonGroup } from "../../FormComponents";
import { RefreshIcon } from "../../Icons";
import styles from "../SettingsPanel.module.css";

export interface WeatherSettingsPanelProps {
  onRegisterSave?: (fn: () => void) => void;
}

/**
 * 天气设置分段组件
 * - 展示当前天气信息与定位来源
 * - 手动刷新天气数据
 */
const WeatherSettingsPanel: React.FC<WeatherSettingsPanelProps> = ({ onRegisterSave }) => {
  const [cache, setCache] = useState(() => getWeatherCache());
  const [weatherRefreshStatus, setWeatherRefreshStatus] = useState<string>("");

  const refreshDisplayData = useCallback(() => {
    setCache(getWeatherCache());
  }, []);

  /**
   * 刷新天气数据（不强制更新地理位置缓存）
   */
  const handleRefreshWeather = useCallback(() => {
    const weatherRefreshEvent = new CustomEvent("weatherRefresh");
    window.dispatchEvent(weatherRefreshEvent);
    setWeatherRefreshStatus("刷新中");
  }, []);

  /**
   * 刷新地理位置：
   * - 清除本地坐标缓存
   * - 触发天气刷新事件
   */
  const handleRefreshLocation = useCallback(() => {
    clearWeatherCache();
    setWeatherRefreshStatus("重新定位中");
    const weatherRefreshEvent = new CustomEvent("weatherRefresh");
    window.dispatchEvent(weatherRefreshEvent);
  }, []);

  useEffect(() => {
    const onDone = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const status = detail.status || "";
      setWeatherRefreshStatus(status);
      refreshDisplayData();
    };
    window.addEventListener("weatherRefreshDone", onDone as EventListener);
    return () => window.removeEventListener("weatherRefreshDone", onDone as EventListener);
  }, [refreshDisplayData]);

  // 天气设置无需保存
  useEffect(() => {
    onRegisterSave?.(() => {});
  }, [onRegisterSave]);

  const now = cache.now?.data.now;
  const refer = cache.now?.data.refer;

  return (
    <div
      className={styles.settingsGroup}
      id="weather-panel"
      role="tabpanel"
      aria-labelledby="weather"
    >
      <h3 className={styles.groupTitle}>天气设置</h3>
      <FormSection title="天气信息">
        <p className={styles.infoText}>
          定位坐标：
          {cache.coords
            ? `${cache.coords.lat.toFixed(4)}, ${cache.coords.lon.toFixed(4)}`
            : "未获取"}
        </p>
        <p className={styles.infoText}>
          定位方式：
          {(() => {
            const source = cache.coords?.source;
            if (!source) return "未获取";
            if (source === "geolocation") return "浏览器定位";
            if (source === "amap_ip") return "高德IP定位";
            if (source === "ip") return "公共IP定位";
            return source;
          })()}
        </p>
        <p className={styles.infoText}>街道地址：{cache.location?.address || "未获取"}</p>
        <p className={styles.infoText}>时间：{now?.obsTime || "未获取"}</p>
        <p className={styles.infoText}>天气：{now?.text || "未获取"}</p>
        <p className={styles.infoText}>
          气温：{now?.temp ? `${now.temp}°C` : "未获取"} 体感：
          {now?.feelsLike ? `${now.feelsLike}°C` : "未获取"}
        </p>
        <p className={styles.infoText}>
          风向：{now?.windDir || "未获取"} 风力：
          {now?.windScale || "未获取"} 风速：
          {now?.windSpeed ? `${now.windSpeed} km/h` : "未获取"}
        </p>
        <p className={styles.infoText}>
          湿度：{now?.humidity ? `${now.humidity}%` : "未获取"} 气压：
          {now?.pressure ? `${now.pressure} hPa` : "未获取"}
        </p>
        <p className={styles.infoText}>
          降水：{now?.precip ? `${now.precip} mm` : "未获取"} 能见度：
          {now?.vis ? `${now.vis} km` : "未获取"} 云量：{now?.cloud || "未获取"}
        </p>
        <p className={styles.infoText}>露点：{now?.dew || "未获取"}</p>
        <p className={styles.infoText}>数据源：{refer?.sources ? "QWeather" : "未获取"}</p>
        <p className={styles.infoText}>
          许可：{refer?.license ? "QWeather Developers License" : "未获取"}
        </p>
        <p className={styles.infoText}>刷新状态：{weatherRefreshStatus || "未刷新"}</p>
        <p className={styles.infoText}>
          最后成功时间：
          {cache.now?.updatedAt ? new Date(cache.now.updatedAt).toLocaleString() : "未成功"}
        </p>
        <FormButtonGroup align="left">
          <FormButton
            variant="secondary"
            onClick={handleRefreshWeather}
            icon={<RefreshIcon size={16} />}
          >
            刷新天气
          </FormButton>
          <FormButton
            variant="secondary"
            onClick={handleRefreshLocation}
            icon={<RefreshIcon size={16} />}
          >
            刷新地理位置
          </FormButton>
        </FormButtonGroup>
      </FormSection>
    </div>
  );
};

export default WeatherSettingsPanel;
