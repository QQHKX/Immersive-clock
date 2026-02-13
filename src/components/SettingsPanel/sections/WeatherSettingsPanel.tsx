import React, { useCallback, useEffect, useState } from "react";

import { useAppDispatch, useAppState } from "../../../contexts/AppContext";
import { getAppSettings, updateGeneralSettings } from "../../../utils/appSettings";
import { broadcastSettingsEvent, SETTINGS_EVENTS } from "../../../utils/settingsEvents";
import { getWeatherCache } from "../../../utils/weatherStorage";
import {
  FormSection,
  FormButton,
  FormButtonGroup,
  FormCheckbox,
  FormRow,
  FormSegmented,
  FormInput,
} from "../../FormComponents";
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
  const [_weatherRefreshStatus, setWeatherRefreshStatus] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshError, setLastRefreshError] = useState<string>("");
  const [messagePopupEnabled, setMessagePopupEnabled] = useState<boolean>(
    !!study.messagePopupEnabled
  );
  const [weatherAlertEnabled, setWeatherAlertEnabled] = useState<boolean>(
    !!study.weatherAlertEnabled
  );
  const [minutelyPrecipEnabled, setMinutelyPrecipEnabled] = useState<boolean>(
    !!study.minutelyPrecipEnabled
  );

  const initialWeatherSettings = getAppSettings().general.weather;
  const [autoRefreshIntervalMin, setAutoRefreshIntervalMin] = useState<number>(() => {
    const v = Number(initialWeatherSettings.autoRefreshIntervalMin);
    return Number.isFinite(v) ? v : 30;
  });
  const [locationMode, setLocationMode] = useState<"auto" | "manual">(
    initialWeatherSettings.locationMode === "manual" ? "manual" : "auto"
  );
  const [manualType, setManualType] = useState<"city" | "coords">(
    initialWeatherSettings.manualLocation?.type === "coords" ? "coords" : "city"
  );
  const [manualCityName, setManualCityName] = useState<string>(() => {
    return String(initialWeatherSettings.manualLocation?.cityName || "");
  });
  const [manualLat, setManualLat] = useState<string>(() => {
    const v = initialWeatherSettings.manualLocation?.lat;
    return typeof v === "number" && Number.isFinite(v) ? String(v) : "";
  });
  const [manualLon, setManualLon] = useState<string>(() => {
    const v = initialWeatherSettings.manualLocation?.lon;
    return typeof v === "number" && Number.isFinite(v) ? String(v) : "";
  });

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
    setIsRefreshing(true);
    setLastRefreshError("");
  }, []);

  const handleRefreshLocationAuto = useCallback(() => {
    const weatherRefreshEvent = new CustomEvent("weatherLocationRefresh", {
      detail: { preferredLocationMode: "auto" },
    });
    window.dispatchEvent(weatherRefreshEvent);
    setWeatherRefreshStatus("刷新中");
    setIsRefreshing(true);
    setLastRefreshError("");
  }, []);

  useEffect(() => {
    const onDone = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const status = detail.status || "";
      setWeatherRefreshStatus(status);
      setIsRefreshing(false);
      setLastRefreshError(String(detail.errorMessage || ""));
      refreshDisplayData();
    };
    window.addEventListener("weatherRefreshDone", onDone as EventListener);
    window.addEventListener("weatherLocationRefreshDone", onDone as EventListener);
    return () => {
      window.removeEventListener("weatherRefreshDone", onDone as EventListener);
      window.removeEventListener("weatherLocationRefreshDone", onDone as EventListener);
    };
  }, [refreshDisplayData]);

  // 注册保存：将“消息弹窗 Beta / 天气提醒”开关持久化
  useEffect(() => {
    onRegisterSave?.(() => {
      dispatch({ type: "SET_MESSAGE_POPUP_ENABLED", payload: messagePopupEnabled });
      dispatch({ type: "SET_WEATHER_ALERT_ENABLED", payload: weatherAlertEnabled });
      dispatch({ type: "SET_MINUTELY_PRECIP_ENABLED", payload: minutelyPrecipEnabled });

      const roundedInterval = Math.round(Number(autoRefreshIntervalMin));
      const intervalOptions = [15, 30, 60];
      const normalizedInterval = intervalOptions.includes(roundedInterval) ? roundedInterval : 30;

      const manualLocation =
        manualType === "coords"
          ? {
              type: "coords" as const,
              lat: Number.isFinite(Number.parseFloat(manualLat))
                ? Number.parseFloat(manualLat)
                : undefined,
              lon: Number.isFinite(Number.parseFloat(manualLon))
                ? Number.parseFloat(manualLon)
                : undefined,
            }
          : {
              type: "city" as const,
              cityName: String(manualCityName || "").trim(),
            };

      updateGeneralSettings({
        weather: {
          autoRefreshIntervalMin: normalizedInterval,
          locationMode,
          manualLocation,
        },
      });

      broadcastSettingsEvent(SETTINGS_EVENTS.WeatherSettingsUpdated, {
        autoRefreshIntervalMin: normalizedInterval,
        locationMode,
        manualLocation,
      });
    });
  }, [
    onRegisterSave,
    dispatch,
    messagePopupEnabled,
    weatherAlertEnabled,
    minutelyPrecipEnabled,
    autoRefreshIntervalMin,
    locationMode,
    manualType,
    manualCityName,
    manualLat,
    manualLon,
  ]);

  const now = cache.now?.data.now;
  const geoDiag = cache.geolocation?.diagnostics;
  const geoHint = (() => {
    const msg = String(geoDiag?.errorMessage || "").toLowerCase();
    if (geoDiag?.errorCode === 2 && msg.includes("network service")) {
      return "提示：Electron/Chromium 可能在调用网络定位服务时失败（常见于 googleapis 不可用）。建议开启 Windows 位置服务（设置→隐私和安全→位置），并在支持定位的浏览器环境中刷新天气。";
    }
    return null;
  })();

  return (
    <div id="weather-panel" role="tabpanel" aria-labelledby="weather">
      <FormSection title="基本设置">
        <FormCheckbox
          label="启用消息弹窗 (Beta)"
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

      <FormSection title="刷新设置">
        <FormRow gap="sm" align="center">
          <FormSegmented
            label="自动刷新间隔"
            value={String(Math.round(autoRefreshIntervalMin))}
            options={[
              { label: "15分钟", value: "15" },
              { label: "30分钟", value: "30" },
              { label: "1小时", value: "60" },
            ]}
            onChange={(v) => setAutoRefreshIntervalMin(Number(v))}
          />
        </FormRow>
      </FormSection>

      <FormSection title="地理位置">
        <FormRow gap="sm" align="center">
          <FormSegmented
            label="定位方式"
            value={locationMode}
            options={[
              { label: "自动定位", value: "auto" },
              { label: "手动设置", value: "manual" },
            ]}
            onChange={(v) => setLocationMode(v as "auto" | "manual")}
          />
        </FormRow>

        {locationMode === "auto" ? (
          <FormButtonGroup align="left">
            <FormButton
              variant="secondary"
              onClick={handleRefreshLocationAuto}
              icon={<RefreshIcon size={16} />}
              loading={isRefreshing}
            >
              刷新定位
            </FormButton>
          </FormButtonGroup>
        ) : null}

        {locationMode === "manual" ? (
          <>
            <FormRow gap="sm" align="center">
              <FormSegmented
                label="手动类型"
                value={manualType}
                options={[
                  { label: "城市名称", value: "city" },
                  { label: "经纬度", value: "coords" },
                ]}
                onChange={(v) => setManualType(v as "city" | "coords")}
              />
            </FormRow>
            {manualType === "city" ? (
              <FormInput
                label="城市名称"
                value={manualCityName}
                onChange={(e) => setManualCityName(e.target.value)}
                placeholder="例如：北京"
              />
            ) : (
              <FormRow gap="sm" align="center">
                <FormInput
                  label="纬度"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  placeholder="例如：39.90"
                  variant="number"
                />
                <FormInput
                  label="经度"
                  value={manualLon}
                  onChange={(e) => setManualLon(e.target.value)}
                  placeholder="例如：116.40"
                  variant="number"
                />
              </FormRow>
            )}
            <p className={styles.helpText}>保存后生效；手动定位优先级高于自动定位。</p>
          </>
        ) : null}

        <div className={styles.weatherInfo} style={{ marginTop: "0.5rem" }}>
          <p className={styles.infoText}>
            当前坐标：
            {cache.coords
              ? `${cache.coords.lat.toFixed(4)}, ${cache.coords.lon.toFixed(4)}`
              : "未获取"}
            <span style={{ margin: "0 8px", opacity: 0.3 }}>|</span>
            来源：
            {(() => {
              const source = cache.coords?.source;
              if (!source) return "未获取";
              if (source === "geolocation") return "浏览器定位";
              if (source === "amap_ip") return "高德IP定位";
              if (source === "ip") return "公共IP定位";
              if (source === "manual_city") return "手动城市";
              if (source === "manual_coords") return "手动经纬度";
              return source;
            })()}
          </p>
          <p className={styles.infoText}>地址：{cache.location?.address || "未获取"}</p>
          {geoDiag ? (
            <p className={styles.infoText} style={{ fontSize: "0.85rem", opacity: 0.8 }}>
              诊断：权限={geoDiag.permissionState}{" "}
              {geoDiag.errorMessage ? `(${geoDiag.errorMessage})` : ""}
            </p>
          ) : null}
          {geoHint ? (
            <p className={styles.infoText} style={{ color: "#ffab40" }}>
              {geoHint}
            </p>
          ) : null}
        </div>
      </FormSection>

      <FormSection title="实时天气">
        <FormButtonGroup align="left">
          <FormButton
            variant="secondary"
            onClick={handleRefreshWeather}
            icon={<RefreshIcon size={16} />}
            loading={isRefreshing}
          >
            刷新数据
          </FormButton>
        </FormButtonGroup>

        <div
          className={styles.weatherInfo}
          style={{ display: "flex", flexDirection: "column", gap: "8px" }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "8px 16px",
            }}
          >
            <p className={styles.infoText}>时间：{now?.obsTime || "未获取"}</p>
            <p className={styles.infoText}>天气：{now?.text || "未获取"}</p>
            <p className={styles.infoText}>
              气温：{now?.temp ? `${now.temp}°C` : "--"}{" "}
              <span style={{ opacity: 0.5, margin: "0 4px" }}>/</span> 体感：
              {now?.feelsLike ? `${now.feelsLike}°C` : "--"}
            </p>
            <p className={styles.infoText}>
              风况：{now?.windDir || "--"} {now?.windScale || "--"}级 (
              {now?.windSpeed ? `${now.windSpeed}km/h` : "--"})
            </p>
            <p className={styles.infoText}>
              空气质量：
              {(() => {
                const idx = cache.airQuality?.data?.indexes?.[0];
                if (!idx) return "未获取";
                return `${idx.name || "AQI"} ${idx.aqi ?? ""} ${idx.category || ""}`;
              })()}
            </p>
            <p className={styles.infoText}>
              日出日落：
              {cache.astronomySun?.data?.sunrise && cache.astronomySun?.data?.sunset
                ? `${cache.astronomySun.data.sunrise} - ${cache.astronomySun.data.sunset}`
                : "未获取"}
            </p>
          </div>

          {/* 湿度与气压条 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 4 }}>
            {(() => {
              const humidity = now?.humidity ? Number.parseFloat(String(now.humidity)) : NaN;
              if (!Number.isFinite(humidity)) return null;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 40, opacity: 0.85, fontSize: "0.85rem" }}>湿度</div>
                  <div
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 2,
                      background: "rgba(255,255,255,0.1)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(0, humidity))}%`,
                        height: "100%",
                        background: "rgba(255,255,255,0.6)",
                      }}
                    />
                  </div>
                  <div
                    style={{ width: 40, textAlign: "right", opacity: 0.85, fontSize: "0.85rem" }}
                  >
                    {Math.round(humidity)}%
                  </div>
                </div>
              );
            })()}
            {(() => {
              const pressure = now?.pressure ? Number.parseFloat(String(now.pressure)) : NaN;
              if (!Number.isFinite(pressure)) return null;
              const ratio = Math.min(1, Math.max(0, (pressure - 900) / 200));
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 40, opacity: 0.85, fontSize: "0.85rem" }}>气压</div>
                  <div
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 2,
                      background: "rgba(255,255,255,0.1)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.round(ratio * 100)}%`,
                        height: "100%",
                        background: "rgba(255,255,255,0.6)",
                      }}
                    />
                  </div>
                  <div
                    style={{ width: 60, textAlign: "right", opacity: 0.85, fontSize: "0.85rem" }}
                  >
                    {Math.round(pressure)}hPa
                  </div>
                </div>
              );
            })()}
          </div>

          <div
            style={{ marginTop: 4, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.1)" }}
          >
            <p className={styles.infoText} style={{ opacity: 0.8 }}>
              未来三日：
              {(() => {
                const daily = cache.daily3d?.data?.daily;
                if (!daily || daily.length === 0) return "未获取";
                return daily
                  .slice(0, 3)
                  .map((d) => `${d.textDay} ${d.tempMin}~${d.tempMax}°`)
                  .join("  |  ");
              })()}
            </p>
          </div>
        </div>

        {lastRefreshError ? (
          <p className={styles.infoText} style={{ color: "#ff5252", marginTop: 8 }}>
            刷新失败：{lastRefreshError}
          </p>
        ) : (
          <p className={styles.infoText} style={{ opacity: 0.5, fontSize: "0.8rem", marginTop: 4 }}>
            数据更新于：
            {cache.now?.updatedAt ? new Date(cache.now.updatedAt).toLocaleTimeString() : "未成功"}
          </p>
        )}
      </FormSection>
    </div>
  );
};

export default WeatherSettingsPanel;
