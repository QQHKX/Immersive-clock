import React, { useCallback, useEffect, useState } from "react";

import { useAppDispatch, useAppState } from "../../../contexts/AppContext";
import { getWeatherCache } from "../../../utils/weatherStorage";
import { FormSection, FormButton, FormButtonGroup, FormCheckbox } from "../../FormComponents";
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
  const { study } = useAppState();
  const dispatch = useAppDispatch();
  const [cache, setCache] = useState(() => getWeatherCache());
  const [weatherRefreshStatus, setWeatherRefreshStatus] = useState<string>("");
  const [messagePopupEnabled, setMessagePopupEnabled] = useState<boolean>(
    !!study.messagePopupEnabled
  );
  const [weatherAlertEnabled, setWeatherAlertEnabled] = useState<boolean>(
    !!study.weatherAlertEnabled
  );
  const [minutelyPrecipEnabled, setMinutelyPrecipEnabled] = useState<boolean>(
    !!study.minutelyPrecipEnabled
  );

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

  // 注册保存：将“消息弹窗 Beta / 天气提醒”开关持久化
  useEffect(() => {
    onRegisterSave?.(() => {
      dispatch({ type: "SET_MESSAGE_POPUP_ENABLED", payload: messagePopupEnabled });
      dispatch({ type: "SET_WEATHER_ALERT_ENABLED", payload: weatherAlertEnabled });
      dispatch({ type: "SET_MINUTELY_PRECIP_ENABLED", payload: minutelyPrecipEnabled });
    });
  }, [
    onRegisterSave,
    dispatch,
    messagePopupEnabled,
    weatherAlertEnabled,
    minutelyPrecipEnabled,
  ]);

  const now = cache.now?.data.now;
  const refer = cache.now?.data.refer;
  const geoDiag = cache.geolocation?.diagnostics;
  const geoHint = (() => {
    const msg = String(geoDiag?.errorMessage || "").toLowerCase();
    if (geoDiag?.errorCode === 2 && msg.includes("network service")) {
      return "提示：Electron/Chromium 可能在调用网络定位服务时失败（常见于 googleapis 不可用）。建议开启 Windows 位置服务（设置→隐私和安全→位置），并在支持定位的浏览器环境中刷新天气。";
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
      <FormSection title="消息弹窗（Beta）">
        <FormCheckbox
          label="启用消息弹窗beta"
          checked={messagePopupEnabled}
          onChange={(e) => setMessagePopupEnabled(e.target.checked)}
        />
        <p className={styles.helpText}>
          开启后，系统可在适当时机显示消息提醒。当前主要用于天气预警与降雨提醒。
        </p>
        <FormCheckbox
          label="天气预警弹窗"
          checked={weatherAlertEnabled}
          onChange={(e) => setWeatherAlertEnabled(e.target.checked)}
          disabled={!messagePopupEnabled}
        />
        <FormCheckbox
          label="降雨提醒弹窗"
          checked={minutelyPrecipEnabled}
          onChange={(e) => setMinutelyPrecipEnabled(e.target.checked)}
          disabled={!messagePopupEnabled}
        />
      </FormSection>

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
        </FormButtonGroup>
      </FormSection>
    </div>
  );
};

export default WeatherSettingsPanel;
