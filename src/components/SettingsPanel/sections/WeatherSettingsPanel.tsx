import React, { useCallback, useEffect, useState } from "react";

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
  const [weatherAddress, setWeatherAddress] = useState<string>(
    () => localStorage.getItem("weather.address") || ""
  );
  const [weatherRefreshStatus, setWeatherRefreshStatus] = useState<string>(
    () => localStorage.getItem("weather.refreshStatus") || ""
  );
  const [weatherLastTs, setWeatherLastTs] = useState<number>(() =>
    parseInt(localStorage.getItem("weather.lastSuccessTs") || "0", 10)
  );

  /**
   * 刷新天气数据（不强制更新地理位置缓存）
   */
  const handleRefreshWeather = useCallback(() => {
    const weatherRefreshEvent = new CustomEvent("weatherRefresh");
    window.dispatchEvent(weatherRefreshEvent);
    setWeatherRefreshStatus("刷新中");
    localStorage.setItem("weather.refreshStatus", "刷新中");
  }, []);

  /**
   * 刷新地理位置：
   * - 清除本地坐标缓存（包括来源与缓存时间）
   * - 触发天气刷新事件，重新执行定位与天气获取流程
   */
  const handleRefreshLocation = useCallback(() => {
    try {
      localStorage.removeItem("weather.coords.lat");
      localStorage.removeItem("weather.coords.lon");
      localStorage.removeItem("weather.coords.cachedAt");
      localStorage.removeItem("weather.coords.source");
    } catch {
      // 忽略本地存储异常
    }
    setWeatherRefreshStatus("重新定位中");
    localStorage.setItem("weather.refreshStatus", "重新定位中");
    const weatherRefreshEvent = new CustomEvent("weatherRefresh");
    window.dispatchEvent(weatherRefreshEvent);
  }, []);

  useEffect(() => {
    const onDone = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const status = detail.status || localStorage.getItem("weather.refreshStatus") || "";
      const address = detail.address || localStorage.getItem("weather.address") || "";
      const ts = detail.ts || parseInt(localStorage.getItem("weather.lastSuccessTs") || "0", 10);
      setWeatherRefreshStatus(status);
      setWeatherAddress(address);
      if (status === "成功") setWeatherLastTs(ts);
    };
    window.addEventListener("weatherRefreshDone", onDone as EventListener);
    return () => window.removeEventListener("weatherRefreshDone", onDone as EventListener);
  }, []);

  // 天气设置无需保存（展示与刷新），但注册一个空操作保持一致
  useEffect(() => {
    onRegisterSave?.(() => {});
  }, [onRegisterSave]);

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
          {(() => {
            const lat = localStorage.getItem("weather.coords.lat");
            const lon = localStorage.getItem("weather.coords.lon");
            return lat && lon
              ? `${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}`
              : "未获取";
          })()}
        </p>
        <p className={styles.infoText}>
          定位方式：
          {(() => {
            const source = localStorage.getItem("weather.coords.source");
            if (!source) return "未获取";
            if (source === "geolocation") return "浏览器定位";
            if (source === "amap_ip") return "高德IP定位";
            if (source === "ip") return "公共IP定位";
            return source;
          })()}
        </p>
        <p className={styles.infoText}>街道地址：{weatherAddress || "未获取"}</p>
        <p className={styles.infoText}>
          时间：{localStorage.getItem("weather.now.obsTime") || "未获取"}
        </p>
        <p className={styles.infoText}>
          天气：{localStorage.getItem("weather.now.text") || "未获取"}
        </p>
        <p className={styles.infoText}>
          气温：
          {localStorage.getItem("weather.now.temp")
            ? `${localStorage.getItem("weather.now.temp")}°C`
            : "未获取"}{" "}
          体感：
          {localStorage.getItem("weather.now.feelsLike")
            ? `${localStorage.getItem("weather.now.feelsLike")}°C`
            : "未获取"}
        </p>
        <p className={styles.infoText}>
          风向：{localStorage.getItem("weather.now.windDir") || "未获取"} 风力：
          {localStorage.getItem("weather.now.windScale") || "未获取"} 风速：
          {localStorage.getItem("weather.now.windSpeed")
            ? `${localStorage.getItem("weather.now.windSpeed")} km/h`
            : "未获取"}
        </p>
        <p className={styles.infoText}>
          湿度：
          {localStorage.getItem("weather.now.humidity")
            ? `${localStorage.getItem("weather.now.humidity")}%`
            : "未获取"}{" "}
          气压：
          {localStorage.getItem("weather.now.pressure")
            ? `${localStorage.getItem("weather.now.pressure")} hPa`
            : "未获取"}
        </p>
        <p className={styles.infoText}>
          降水：
          {localStorage.getItem("weather.now.precip")
            ? `${localStorage.getItem("weather.now.precip")} mm`
            : "未获取"}{" "}
          能见度：
          {localStorage.getItem("weather.now.vis")
            ? `${localStorage.getItem("weather.now.vis")} km`
            : "未获取"}{" "}
          云量：{localStorage.getItem("weather.now.cloud") || "未获取"}
        </p>
        <p className={styles.infoText}>
          露点：{localStorage.getItem("weather.now.dew") || "未获取"}
        </p>
        <p className={styles.infoText}>
          数据源：
          {(() => {
            const sources = localStorage.getItem("weather.refer.sources");
            return sources ? "QWeather" : "未获取";
          })()}
        </p>
        <p className={styles.infoText}>
          许可：
          {(() => {
            const license = localStorage.getItem("weather.refer.license");
            return license ? "QWeather Developers License" : "未获取";
          })()}
        </p>
        <p className={styles.infoText}>刷新状态：{weatherRefreshStatus || "未刷新"}</p>
        <p className={styles.infoText}>
          最后成功时间：{weatherLastTs > 0 ? new Date(weatherLastTs).toLocaleString() : "未成功"}
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
