import React, { useCallback, useEffect, useState } from "react";

import type { GeolocationDiagnostics } from "../../../services/weatherService";
import {
  getWeatherCache,
  clearWeatherCache,
  updateCoordsCache,
  updateGeolocationDiagnostics,
} from "../../../utils/weatherStorage";
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
   * 通过用户手势直接请求浏览器 GPS 定位：
   * - 在部分移动端/WebView 中，权限弹窗需要由用户点击触发；因此这里不走事件链路而是直接调用 geolocation
   * - 成功后写入坐标缓存并触发一次天气刷新
   */
  const handleRequestGpsLocation = useCallback(() => {
    const attemptedAt = Date.now();
    const writeDiagnostics = (d: GeolocationDiagnostics) => updateGeolocationDiagnostics(d);

    if (typeof window === "undefined" || typeof navigator === "undefined") {
      setWeatherRefreshStatus("无法请求定位：非浏览器环境");
      writeDiagnostics({
        isSupported: false,
        isSecureContext: false,
        permissionState: "unknown",
        usedHighAccuracy: true,
        timeoutMs: 25000,
        maximumAgeMs: 60 * 1000,
        attemptedAt,
        errorMessage: "非浏览器环境",
      });
      return;
    }
    if (!window.isSecureContext) {
      setWeatherRefreshStatus("无法请求定位：需要 HTTPS 或安全上下文");
      writeDiagnostics({
        isSupported: "geolocation" in navigator,
        isSecureContext: false,
        permissionState: "unknown",
        usedHighAccuracy: true,
        timeoutMs: 25000,
        maximumAgeMs: 60 * 1000,
        attemptedAt,
        errorMessage: "需要 HTTPS 或安全上下文",
      });
      return;
    }
    if (!("geolocation" in navigator)) {
      setWeatherRefreshStatus("无法请求定位：当前环境不支持定位");
      writeDiagnostics({
        isSupported: false,
        isSecureContext: true,
        permissionState: "unsupported",
        usedHighAccuracy: true,
        timeoutMs: 25000,
        maximumAgeMs: 60 * 1000,
        attemptedAt,
        errorMessage: "当前环境不支持定位",
      });
      return;
    }

    setWeatherRefreshStatus("请求GPS定位中");

    const runOnce = (cfg: PositionOptions) => {
      return new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, cfg);
      });
    };

    const optionsHigh: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 25000,
      maximumAge: 60 * 1000,
    };

    const optionsLow: PositionOptions = {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 60 * 1000,
    };

    let usedHighAccuracy = true;
    runOnce(optionsHigh)
      .catch((err: GeolocationPositionError) => {
        if (err?.code === 3) {
          usedHighAccuracy = false;
          return runOnce(optionsLow);
        }
        throw err;
      })
      .then((pos) => {
        const lat = pos?.coords?.latitude;
        const lon = pos?.coords?.longitude;
        if (typeof lat === "number" && typeof lon === "number") {
          updateCoordsCache(lat, lon, "geolocation");
          writeDiagnostics({
            isSupported: true,
            isSecureContext: true,
            permissionState: "unknown",
            usedHighAccuracy,
            timeoutMs: 25000,
            maximumAgeMs: 60 * 1000,
            attemptedAt,
          });
          setWeatherRefreshStatus("GPS定位成功");
          const weatherRefreshEvent = new CustomEvent("weatherRefresh");
          window.dispatchEvent(weatherRefreshEvent);
        } else {
          writeDiagnostics({
            isSupported: true,
            isSecureContext: true,
            permissionState: "unknown",
            usedHighAccuracy,
            timeoutMs: 25000,
            maximumAgeMs: 60 * 1000,
            attemptedAt,
            errorMessage: "坐标无效",
          });
          setWeatherRefreshStatus("GPS定位失败：坐标无效");
        }
      })
      .catch((err: unknown) => {
        const code = (err as { code?: number })?.code;
        const msg = (err as { message?: string })?.message;
        writeDiagnostics({
          isSupported: true,
          isSecureContext: true,
          permissionState: "unknown",
          usedHighAccuracy,
          timeoutMs: 25000,
          maximumAgeMs: 60 * 1000,
          attemptedAt,
          errorCode: typeof code === "number" ? code : undefined,
          errorMessage: msg,
        });
        if (code === 1) {
          setWeatherRefreshStatus("GPS定位失败：权限被拒绝");
          return;
        }
        if (code === 2) {
          setWeatherRefreshStatus("GPS定位失败：位置不可用");
          return;
        }
        if (code === 3) {
          setWeatherRefreshStatus("GPS定位失败：超时");
          return;
        }
        setWeatherRefreshStatus(`GPS定位失败${msg ? `：${msg}` : ""}`);
      });
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
    onRegisterSave?.(() => { });
  }, [onRegisterSave]);

  const now = cache.now?.data.now;
  const refer = cache.now?.data.refer;
  const geoDiag = cache.geolocation?.diagnostics;
  const geoHint = (() => {
    const msg = String(geoDiag?.errorMessage || "").toLowerCase();
    if (geoDiag?.errorCode === 2 && msg.includes("network service")) {
      return "提示：Electron/Chromium 可能在调用网络定位服务时失败（常见于 googleapis 不可用）。建议开启 Windows 位置服务（设置→隐私和安全→位置），并点击“请求GPS定位”重试。";
    }
    return null;
  })();

  return (
    <div
      className={styles.settingsGroup}
      id="weather-panel"
      role="tabpanel"
      aria-labelledby="weather"
    >
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
        <p className={styles.infoText}>
          定位诊断：
          {geoDiag
            ? `安全上下文=${geoDiag.isSecureContext ? "是" : "否"} 权限=${geoDiag.permissionState}${geoDiag.errorCode ? ` 错误码=${geoDiag.errorCode}` : ""
            }${geoDiag.errorMessage ? ` 原因=${geoDiag.errorMessage}` : ""}`
            : "未获取"}
        </p>
        {geoHint ? <p className={styles.infoText}>{geoHint}</p> : null}
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
            onClick={handleRequestGpsLocation}
            icon={<RefreshIcon size={16} />}
          >
            请求GPS定位
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
