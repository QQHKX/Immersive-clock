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

function formatDateHM(iso?: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${dd} ${hh}:${mm}`;
}

function formatSunHM(iso?: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

const WindIcon: React.FC<{ size?: number; angle?: number; className?: string }> = ({
  size = 20,
  angle = 0,
  className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ transform: `rotate(${angle + 180}deg)`, transition: "transform 0.3s ease" }}
  >
    <path d="M12 19V5" />
    <path d="M5 12l7 7 7-7" />
  </svg>
);

const SunriseIcon: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }> = ({
  size = 20,
  className,
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <path d="M17 18a5 5 0 0 0-10 0" />
    <line x1="12" y1="2" x2="12" y2="9" />
    <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" />
    <line x1="1" y1="18" x2="3" y2="18" />
    <line x1="21" y1="18" x2="23" y2="18" />
    <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
    <line x1="23" y1="22" x2="1" y2="22" />
    <polyline points="8 6 12 2 16 6" />
  </svg>
);

const SunsetIcon: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }> = ({
  size = 20,
  className,
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <path d="M17 18a5 5 0 0 0-10 0" />
    <line x1="12" y1="9" x2="12" y2="2" />
    <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" />
    <line x1="1" y1="18" x2="3" y2="18" />
    <line x1="21" y1="18" x2="23" y2="18" />
    <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
    <line x1="23" y1="22" x2="1" y2="22" />
    <polyline points="16 5 12 9 8 5" />
  </svg>
);

/**
 * 根据 AQI 数值获取对应的颜色
 * @param aqi AQI 数值
 */
function getAqiColor(aqi: number): string {
  if (!Number.isFinite(aqi)) return "#9e9e9e";
  if (aqi <= 50) return "#4caf50"; // 优 - 绿色
  if (aqi <= 100) return "#ffc107"; // 良 - 黄色
  if (aqi <= 150) return "#ff9800"; // 轻度 - 橙色
  if (aqi <= 200) return "#f44336"; // 中度 - 红色
  if (aqi <= 300) return "#9c27b0"; // 重度 - 紫色
  return "#7f0000"; // 严重 - 深红
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
  const [weatherAlertEnabled, setWeatherAlertEnabled] = useState<boolean>(
    !!study.weatherAlertEnabled
  );
  const [minutelyPrecipEnabled, setMinutelyPrecipEnabled] = useState<boolean>(
    !!study.minutelyPrecipEnabled
  );
  const [airQualityAlertEnabled, setAirQualityAlertEnabled] = useState<boolean>(
    !!study.airQualityAlertEnabled
  );
  const [sunriseSunsetAlertEnabled, setSunriseSunsetAlertEnabled] = useState<boolean>(
    !!study.sunriseSunsetAlertEnabled
  );
  const [classEndForecastEnabled, setClassEndForecastEnabled] = useState<boolean>(
    !!study.classEndForecastEnabled
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
    const weatherRefreshEvent = new CustomEvent("weatherRefresh", {
      detail: { showErrorPopup: true },
    });
    window.dispatchEvent(weatherRefreshEvent);
    setWeatherRefreshStatus("刷新中");
    setIsRefreshing(true);
  }, []);

  const handleRefreshLocationAuto = useCallback(() => {
    const weatherRefreshEvent = new CustomEvent("weatherLocationRefresh", {
      detail: { preferredLocationMode: "auto", showErrorPopup: true },
    });
    window.dispatchEvent(weatherRefreshEvent);
    setWeatherRefreshStatus("刷新中");
    setIsRefreshing(true);
  }, []);

  useEffect(() => {
    const onDone = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const status = detail.status || "";
      setWeatherRefreshStatus(status);
      setIsRefreshing(false);
      refreshDisplayData();
    };
    window.addEventListener("weatherRefreshDone", onDone as EventListener);
    window.addEventListener("weatherLocationRefreshDone", onDone as EventListener);
    return () => {
      window.removeEventListener("weatherRefreshDone", onDone as EventListener);
      window.removeEventListener("weatherLocationRefreshDone", onDone as EventListener);
    };
  }, [refreshDisplayData]);

  // 注册保存：将天气提醒开关持久化
  useEffect(() => {
    onRegisterSave?.(() => {
      dispatch({ type: "SET_WEATHER_ALERT_ENABLED", payload: weatherAlertEnabled });
      dispatch({ type: "SET_MINUTELY_PRECIP_ENABLED", payload: minutelyPrecipEnabled });
      dispatch({ type: "SET_AIR_QUALITY_ALERT_ENABLED", payload: airQualityAlertEnabled });
      dispatch({ type: "SET_SUNRISE_SUNSET_ALERT_ENABLED", payload: sunriseSunsetAlertEnabled });
      dispatch({ type: "SET_CLASS_END_FORECAST_ENABLED", payload: classEndForecastEnabled });

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
    weatherAlertEnabled,
    minutelyPrecipEnabled,
    airQualityAlertEnabled,
    sunriseSunsetAlertEnabled,
    classEndForecastEnabled,
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
        <p className={styles.helpText}>用于控制天气预警与分钟级降水提醒弹窗显示。</p>
        <div className={styles.checkboxGrid}>
          <FormCheckbox
            label="天气预警弹窗"
            checked={weatherAlertEnabled}
            onChange={(e) => setWeatherAlertEnabled(e.target.checked)}
          />
          <FormCheckbox
            label="分钟级降水提醒"
            checked={minutelyPrecipEnabled}
            onChange={(e) => setMinutelyPrecipEnabled(e.target.checked)}
          />
          <FormCheckbox
            label="空气污染提醒"
            checked={airQualityAlertEnabled}
            onChange={(e) => setAirQualityAlertEnabled(e.target.checked)}
          />
          <FormCheckbox
            label="日出日落提醒"
            checked={sunriseSunsetAlertEnabled}
            onChange={(e) => setSunriseSunsetAlertEnabled(e.target.checked)}
          />
          <FormCheckbox
            label="下课前5分钟预报提醒"
            checked={classEndForecastEnabled}
            onChange={(e) => setClassEndForecastEnabled(e.target.checked)}
          />
        </div>
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
            {cache.coords ? `${cache.coords.lat.toFixed(4)}, ${cache.coords.lon.toFixed(4)}` : "--"}
            <span style={{ margin: "0 8px", opacity: 0.3 }}>|</span>
            来源：
            {(() => {
              const source = cache.coords?.source;
              if (!source) return "--";
              if (source === "geolocation") return "浏览器定位";
              if (source === "amap_ip") return "高德IP定位";
              if (source === "ip") return "公共IP定位";
              if (source === "manual_city") return "手动城市";
              if (source === "manual_coords") return "手动经纬度";
              return source;
            })()}
          </p>
          <p className={styles.infoText}>地址：{cache.location?.address || "--"}</p>
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
          style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}
        >
          {/* 顶部：时间与概况 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              borderBottom: "1px solid rgba(255,255,255,0.1)",
              paddingBottom: "8px",
            }}
          >
            <div style={{ fontSize: "0.95rem", fontWeight: 500 }}>
              {now?.obsTime ? formatDateHM(now.obsTime) : "--"}
            </div>
            <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>{now?.text || "--"}</div>
          </div>

          {/* 主要数据区域：三列布局 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "12px",
              alignItems: "center",
            }}
          >
            {/* 气温 */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "2rem",
                  fontWeight: "bold",
                  lineHeight: 1,
                  color: "var(--accent-color, #4fc3f7)",
                }}
              >
                {now?.temp || "--"}°
              </div>
              <div style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: 4 }}>
                体感 {now?.feelsLike || "--"}°
              </div>
            </div>

            {/* 风况与空气质量 */}
            <div
              style={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <WindIcon size={20} angle={Number(now?.wind360) || 0} />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    lineHeight: 1.2,
                  }}
                >
                  <div style={{ fontSize: "0.85rem" }}>
                    {now?.windDir || "--"} {now?.windScale ? `${now.windScale}级` : ""}
                  </div>
                  <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                    {now?.windSpeed ? `${now.windSpeed}km/h` : ""}
                  </div>
                </div>
              </div>

              {(() => {
                const idx = cache.airQuality?.data?.indexes?.[0];
                if (!idx || typeof idx.aqi !== "number")
                  return <div style={{ fontSize: "0.8rem", opacity: 0.5 }}>AQI --</div>;
                const color = getAqiColor(idx.aqi);
                return (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "0.75rem",
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: color,
                        boxShadow: `0 0 4px ${color}`,
                      }}
                    />
                    <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
                      AQI {idx.aqi}
                    </span>
                    <span style={{ opacity: 0.8, fontSize: "0.7rem" }}>{idx.category}</span>
                  </div>
                );
              })()}
            </div>

            {/* 日出日落 */}
            <div
              style={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <SunriseIcon size={18} style={{ opacity: 0.7 }} />
                <div style={{ fontSize: "0.9rem", fontFamily: "var(--font-main)" }}>
                  {cache.astronomySun?.data?.sunrise
                    ? formatSunHM(cache.astronomySun.data.sunrise)
                    : "--:--"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <SunsetIcon size={18} style={{ opacity: 0.7 }} />
                <div style={{ fontSize: "0.9rem", fontFamily: "var(--font-main)" }}>
                  {cache.astronomySun?.data?.sunset
                    ? formatSunHM(cache.astronomySun.data.sunset)
                    : "--:--"}
                </div>
              </div>
            </div>
          </div>

          {/* 湿度与气压 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              background: "rgba(0,0,0,0.1)",
              padding: "8px",
              borderRadius: "8px",
            }}
          >
            {/* 湿度 */}
            {(() => {
              const humidity = now?.humidity ? Number.parseFloat(String(now.humidity)) : NaN;
              if (!Number.isFinite(humidity))
                return (
                  <div style={{ opacity: 0.5, fontSize: "0.8rem", textAlign: "center" }}>
                    湿度 --
                  </div>
                );
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>湿度</div>
                  <div
                    style={{
                      flex: 1,
                      height: 4,
                      background: "rgba(255,255,255,0.1)",
                      borderRadius: 2,
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(0, humidity))}%`,
                        height: "100%",
                        background: "#4fc3f7",
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: "0.8rem", minWidth: 24, textAlign: "right" }}>
                    {Math.round(humidity)}%
                  </div>
                </div>
              );
            })()}

            {/* 气压 */}
            {(() => {
              const pressure = now?.pressure ? Number.parseFloat(String(now.pressure)) : NaN;
              if (!Number.isFinite(pressure))
                return (
                  <div style={{ opacity: 0.5, fontSize: "0.8rem", textAlign: "center" }}>
                    气压 --
                  </div>
                );
              const ratio = Math.min(1, Math.max(0, (pressure - 900) / 200));
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>气压</div>
                  <div
                    style={{
                      flex: 1,
                      height: 4,
                      background: "rgba(255,255,255,0.1)",
                      borderRadius: 2,
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.round(ratio * 100)}%`,
                        height: "100%",
                        background: "#81c784",
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: "0.8rem", minWidth: 40, textAlign: "right" }}>
                    {Math.round(pressure)}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 未来预报 */}
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: "0.8rem", opacity: 0.6, marginBottom: 6 }}>未来三日</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {(() => {
                const daily = cache.daily3d?.data?.daily;
                if (!daily || daily.length === 0)
                  return (
                    <div style={{ gridColumn: "1 / -1", textAlign: "center", opacity: 0.5 }}>
                      暂无预报数据
                    </div>
                  );
                return daily.slice(0, 3).map((d, i) => (
                  <div
                    key={i}
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      padding: "6px",
                      borderRadius: "6px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>{d.textDay}</div>
                    <div style={{ fontSize: "0.8rem", marginTop: 2 }}>
                      {d.tempMin}°~{d.tempMax}°
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        <p
          className={styles.infoText}
          style={{
            opacity: 0.4,
            fontSize: "0.75rem",
            marginTop: 8,
            textAlign: "right",
          }}
        >
          数据更新于：
          {cache.now?.updatedAt ? new Date(cache.now.updatedAt).toLocaleTimeString() : "--"}
        </p>
      </FormSection>
    </div>
  );
};

export default WeatherSettingsPanel;
