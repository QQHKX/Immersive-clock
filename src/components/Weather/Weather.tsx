import React, { useState, useEffect, useCallback } from 'react';
import styles from './Weather.module.css';
import { buildWeatherFlow, calculateMinutelyPrecipAlert } from '../../services/weatherService';
import React, { useState, useEffect, useCallback, useRef } from "react";

import { useAppState } from "../../contexts/AppContext";
import { buildLocationFlow } from "../../services/locationService";
import {
  buildWeatherFlow,
  fetchWeatherAlertsByCoords,
  fetchMinutelyPrecip,
  fetchWeatherHourly72h,
} from "../../services/weatherService";
import type { WeatherFlowOptions } from "../../services/weatherService";
import type { MinutelyPrecipResponse } from "../../types/weather";
import { getAppSettings } from "../../utils/appSettings";
import { logger } from "../../utils/logger";
import {
  computeMinutelyRainStats,
  resolveMinutelyRainPhase,
  shouldTriggerCriticalRefresh,
} from "../../utils/minutelyPrecipLogic";
import type {
  MinutelyPrecipCacheLike,
  MinutelyRainPhase,
  MinutelyRainStats,
} from "../../utils/minutelyPrecipLogic";
import { SETTINGS_EVENTS, subscribeSettingsEvent } from "../../utils/settingsEvents";
import { getAdjustedDate } from "../../utils/timeSync";
import {
  getWeatherCache,
  updateWeatherNowSnapshot,
  updateMinutelyCache,
  getValidMinutely,
  getValidCoords,
  updateMinutelyLastFetch,
  updateMinutelyCriticalFetch,
  updateHourly72hCache,
  updateHourly72hLastFetch,
  updateAlertTag,
  updateDaily3dCache,
  updateAirQualityCache,
  updateAstronomySunCache,
} from "../../utils/weatherStorage";

import styles from "./Weather.module.css";

const MINUTELY_PRECIP_POPUP_ID = "weather:minutelyPrecip";
const MINUTELY_PRECIP_POPUP_SHOWN_KEY = "weather.minutely.popupShown";
const MINUTELY_PRECIP_POPUP_OPEN_KEY = "weather.minutely.popupOpen";
const MINUTELY_PRECIP_POPUP_DISMISSED_KEY = "weather.minutely.popupDismissed";
const MINUTELY_PRECIP_PRE_NOTIFIED_START_KEY = "weather.minutely.preNotifiedStartAt";
const MINUTELY_PRECIP_RAIN_NOTIFIED_START_KEY = "weather.minutely.rainNotifiedStartAt";
const AIR_QUALITY_REMINDER_KEY_PREFIX = "weather.airQuality.reminded.";
const SUNRISE_REMINDER_KEY_PREFIX = "weather.sunrise.reminded.";
const SUNSET_REMINDER_KEY_PREFIX = "weather.sunset.reminded.";

const MINUTELY_PRECIP_MANUAL_REFRESH_EVENT = "weatherMinutelyPrecipRefresh";
const MINUTELY_PRECIP_DIFF_THRESHOLD_PROB = 10;
const MINUTELY_PRECIP_LOCAL_TICK_MS = 30 * 1000;
const WEATHER_LOCATION_REFRESH_EVENT = "weatherLocationRefresh";
const WEATHER_LOCATION_REFRESH_DONE_EVENT = "weatherLocationRefreshDone";
const CLASS_END_FORECAST_HOURLY_REFRESH_MS = 30 * 60 * 1000;

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function formatDateYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * 格式化时间戳为 HH:mm
 */
function formatTimestampHm(ms: number): string {
  const d = new Date(ms);
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${hh}:${mm}`;
}

function mapWeatherAlertColorToThemeColor(code?: string | null): string | undefined {
  if (!code) return undefined;
  const normalized = String(code).trim().toLowerCase();
  if (!normalized) return undefined;

  if (normalized === "red" || normalized.includes("红")) return "#ef4444";
  if (normalized === "orange" || normalized.includes("橙")) return "#f97316";
  if (normalized === "yellow" || normalized.includes("黄")) return "#f5a524";
  if (normalized === "blue" || normalized.includes("蓝")) return "#3b82f6";
  if (normalized === "white" || normalized.includes("白")) return "#ffffff";
  return undefined;
}

/**
 * 根据 AQI 数值计算对应的语义颜色（函数级中文注释：按常见 AQI 分级返回用于强调文本的颜色值）
 */
function getAqiColor(aqi: number): string {
  if (!Number.isFinite(aqi)) return "#ffffff";
  if (aqi <= 50) return "#22c55e"; // 优
  if (aqi <= 100) return "#f5a524"; // 良
  if (aqi <= 150) return "#f97316"; // 轻度污染
  if (aqi <= 200) return "#ef4444"; // 中度污染
  if (aqi <= 300) return "#a855f7"; // 重度污染
  return "#7f1d1d"; // 严重污染
}

/**
 * 根据 AQI 数值计算对应的等级描述（函数级中文注释：用于在提醒里展示污染等级文案）
 */
function getAqiLevelText(aqi: number): string {
  if (!Number.isFinite(aqi)) return "";
  if (aqi <= 50) return "优";
  if (aqi <= 100) return "良";
  if (aqi <= 150) return "轻度污染";
  if (aqi <= 200) return "中度污染";
  if (aqi <= 300) return "重度污染";
  return "严重污染";
}

/**
 * 安全读取 SessionStorage 标志
 */
function safeReadSessionFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function safeWriteSessionFlag(key: string, value: boolean): void {
  try {
    sessionStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* 忽略错误 */
  }
}

/**
 * 安全读取 SessionStorage 文本值
 */
function safeReadSessionValue(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * 安全写入 SessionStorage 文本值
 */
function safeWriteSessionValue(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* 忽略错误 */
  }
}

/**
 * 安全删除 SessionStorage 文本值
 */
function safeRemoveSessionValue(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* 忽略错误 */
  }
}

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
  const showErrorPopupRef = useRef<boolean>(false);
  const lastErrorPopupAtRef = useRef<number>(0);
  const lastErrorPopupSignatureRef = useRef<string>("");
  const minutelyPopupHasRainRef = useRef<boolean | null>(null);
  const minutelyPhaseRef = useRef<MinutelyRainPhase | null>(null);
  const lastCriticalMinutelyFetchAtRef = useRef<number>(0);
  const [autoRefreshIntervalMin, setAutoRefreshIntervalMin] = useState<number>(() => {
    return clampInt(getAppSettings().general.weather.autoRefreshIntervalMin, 15, 180);
  });

  const maybeOpenErrorPopup = useCallback(
    (title: string, message: string) => {
      if (!study.errorPopupEnabled) return;
      if (!showErrorPopupRef.current) return;

      showErrorPopupRef.current = false;

      const now = Date.now();
      const signature = `${title}::${message}`;
      if (
        signature === lastErrorPopupSignatureRef.current &&
        now - lastErrorPopupAtRef.current < 5000
      ) {
        return;
      }
      lastErrorPopupAtRef.current = now;
      lastErrorPopupSignatureRef.current = signature;

      window.dispatchEvent(
        new CustomEvent("messagePopup:open", {
          detail: {
            type: "error",
            title,
            message,
          },
        })
      );
    },
    [study.errorPopupEnabled]
  );

  useEffect(() => {
    const updateInterval = () => {
      setAutoRefreshIntervalMin(
        clampInt(getAppSettings().general.weather.autoRefreshIntervalMin, 15, 180)
      );
    };
    const offSaved = subscribeSettingsEvent(SETTINGS_EVENTS.SettingsSaved, updateInterval);
    const offWeather = subscribeSettingsEvent(
      SETTINGS_EVENTS.WeatherSettingsUpdated,
      updateInterval
    );
    return () => {
      offSaved();
      offWeather();
    };
  }, []);

  const readMinutelyCache = useCallback((): MinutelyPrecipCacheLike | null => {
    const coords = getValidCoords();
    if (coords) {
      const location = `${coords.lon.toFixed(2)},${coords.lat.toFixed(2)}`;
      const data = getValidMinutely(location);
      if (data) {
        const cache = getWeatherCache();
        const meta = cache.minutely?.location === location ? cache.minutely : undefined;
        return {
          updateTime: data.updateTime,
          summary: data.summary,
          minutely: data.minutely,
          fetchedAt: meta?.lastApiFetchAt ?? meta?.updatedAt ?? Date.now(),
        };
      }
    }
    return null;
  }, []);

  const writeMinutelyCache = useCallback((data: MinutelyPrecipResponse, fetchedAt: number) => {
    const coords = getValidCoords();
    if (coords) {
      const location = `${coords.lon.toFixed(2)},${coords.lat.toFixed(2)}`;
      updateMinutelyCache(location, data, fetchedAt);
    }
  }, []);

  /**
   * 构建分钟级降水弹窗内容（函数级中文注释：区分“将要下雨”与“正在下雨”，并展示开始/结束时间）
   */
  const buildMinutelyPrecipPopupMessage = useCallback(
    (
      cache: MinutelyPrecipCacheLike,
      stats: MinutelyRainStats,
      opts?: { showUpdatedHint?: boolean }
    ): React.ReactNode => {
      const nowMs = Date.now();
      const pulledAtMs = cache.fetchedAt ?? nowMs;
      const pulledAtText = formatTimestampHm(pulledAtMs);
      const rainEndText = stats.rainEndAt ? formatTimestampHm(stats.rainEndAt) : "--:--";
      const rainStartText = stats.nextRainStartAt
        ? formatTimestampHm(stats.nextRainStartAt)
        : "--:--";

      if (stats.isRainingNow) {
        const line1 = `正在${stats.intensityLabel}，预计${rainEndText}前后结束。`;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div>{line1}</div>
            <div>
              降水概率：{stats.probability}% 预计累计：{stats.expectedAmountMm.toFixed(1)}mm
            </div>
            <div>剩余时长：约{stats.remainingMinutes ?? 0}分钟</div>
            <div style={{ opacity: 0.8, fontSize: "0.72rem" }}>数据拉取时间：{pulledAtText}</div>
          </div>
        );
      }

      const summary = stats.hasRain
        ? `预计${rainStartText}开始${stats.intensityLabel}，持续约${stats.durationMinutes ?? "--"}分钟。`
        : "未来两小时暂无降水。";
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div>{summary}</div>
          <div>降水概率：{stats.probability}%</div>
          {stats.hasRain ? <div>距离降雨：约{stats.leadMinutes ?? 0}分钟</div> : null}
          <div style={{ opacity: 0.8, fontSize: "0.72rem" }}>数据拉取时间：{pulledAtText}</div>
          {opts?.showUpdatedHint ? (
            <div style={{ opacity: 0.8, fontSize: "0.72rem" }}>分钟级数据已更新</div>
          ) : null}
        </div>
      );
    },
    []
  );

  /**
   * 发送分钟级降水弹窗（函数级中文注释：统一处理打开与内容刷新）
   */
  const emitMinutelyPopup = useCallback(
    (
      cache: MinutelyPrecipCacheLike,
      stats: MinutelyRainStats,
      opts?: { showUpdatedHint?: boolean }
    ) => {
      const message = buildMinutelyPrecipPopupMessage(cache, stats, {
        showUpdatedHint: opts?.showUpdatedHint,
      });
      window.dispatchEvent(
        new CustomEvent("messagePopup:open", {
          detail: {
            id: MINUTELY_PRECIP_POPUP_ID,
            type: "weatherForecast",
            title: "分钟级降水提醒",
            message,
            themeColor: "#ffffff",
          },
        })
      );
    },
    [buildMinutelyPrecipPopupMessage]
  );

  /**
   * 评估并处理分钟级状态（函数级中文注释：负责状态机推进、弹窗触发、去重与自动关闭）
   */
  const evaluateMinutelyState = useCallback(
    (
      cache: MinutelyPrecipCacheLike,
      opts?: {
        allowOpen?: boolean;
        showUpdatedHint?: boolean;
        forceRainingPopup?: boolean;
      }
    ) => {
      if (!study?.minutelyPrecipEnabled) return;
      const nowMs = Date.now();
      const stats = computeMinutelyRainStats(cache, nowMs);
      const phase = resolveMinutelyRainPhase(stats, minutelyPhaseRef.current);
      minutelyPhaseRef.current = phase;

      if (!stats.hasRain) {
        const wasOpen = safeReadSessionFlag(MINUTELY_PRECIP_POPUP_OPEN_KEY);
        minutelyPopupHasRainRef.current = false;
        safeWriteSessionFlag(MINUTELY_PRECIP_POPUP_OPEN_KEY, false);
        safeWriteSessionFlag(MINUTELY_PRECIP_POPUP_SHOWN_KEY, false);
        safeRemoveSessionValue(MINUTELY_PRECIP_PRE_NOTIFIED_START_KEY);
        safeRemoveSessionValue(MINUTELY_PRECIP_RAIN_NOTIFIED_START_KEY);
        if (wasOpen) {
          window.dispatchEvent(
            new CustomEvent("messagePopup:close", {
              detail: { id: MINUTELY_PRECIP_POPUP_ID, dismiss: false },
            })
          );
        }
        return;
      }

      const popupDismissed = safeReadSessionFlag(MINUTELY_PRECIP_POPUP_DISMISSED_KEY);
      const popupOpen = safeReadSessionFlag(MINUTELY_PRECIP_POPUP_OPEN_KEY);
      const rainStartAt = stats.rainStartAt ?? 0;
      const preNotifiedStartAt = Number(
        safeReadSessionValue(MINUTELY_PRECIP_PRE_NOTIFIED_START_KEY) || "0"
      );
      const rainNotifiedStartAt = Number(
        safeReadSessionValue(MINUTELY_PRECIP_RAIN_NOTIFIED_START_KEY) || "0"
      );

      const shouldOpenPreRain =
        !!opts?.allowOpen &&
        !popupDismissed &&
        phase === "PRE_RAIN" &&
        rainStartAt > 0 &&
        preNotifiedStartAt !== rainStartAt;
      const shouldOpenRaining =
        (!!opts?.allowOpen &&
          !popupDismissed &&
          phase === "RAINING" &&
          rainStartAt > 0 &&
          rainNotifiedStartAt !== rainStartAt) ||
        (!!opts?.forceRainingPopup && phase === "RAINING");

      if (shouldOpenPreRain || shouldOpenRaining) {
        emitMinutelyPopup(cache, stats, { showUpdatedHint: opts?.showUpdatedHint });
        safeWriteSessionFlag(MINUTELY_PRECIP_POPUP_OPEN_KEY, true);
        safeWriteSessionFlag(MINUTELY_PRECIP_POPUP_SHOWN_KEY, true);
        minutelyPopupHasRainRef.current = true;
        if (shouldOpenPreRain) {
          safeWriteSessionValue(MINUTELY_PRECIP_PRE_NOTIFIED_START_KEY, String(rainStartAt));
        }
        if (phase === "RAINING" && rainStartAt > 0) {
          safeWriteSessionValue(MINUTELY_PRECIP_RAIN_NOTIFIED_START_KEY, String(rainStartAt));
        }
        return;
      }

      if (popupOpen && !popupDismissed) {
        emitMinutelyPopup(cache, stats, { showUpdatedHint: opts?.showUpdatedHint });
        minutelyPopupHasRainRef.current = true;
      }
    },
    [emitMinutelyPopup, study?.minutelyPrecipEnabled]
  );

  /**
   * 从缓存重算分钟级状态（函数级中文注释：不调用 API，仅按本地时间推进分钟级提醒）
   */
  const recomputeMinutelyPrecipLocally = useCallback(
    (opts?: { allowOpen?: boolean; showUpdatedHint?: boolean; forceRainingPopup?: boolean }) => {
      if (!study?.minutelyPrecipEnabled) return;
      const cache = readMinutelyCache();
      if (!cache) return;
      evaluateMinutelyState(cache, opts);
    },
    [evaluateMinutelyState, readMinutelyCache, study?.minutelyPrecipEnabled]
  );

  /**
   * 刷新分钟级降水数据（函数级中文注释：采用“缓存优先 + 关键时刻加密请求”的策略）
   */
  const refreshMinutelyPrecip = useCallback(
    async (
      locationParam: string,
      opts?: {
        forceApi?: boolean;
        allowOpen?: boolean;
        showUpdatedHint?: boolean;
      }
    ) => {
      if (!study?.minutelyPrecipEnabled) return;

      const nowMs = Date.now();
      const minutelyApiIntervalMs = clampInt(autoRefreshIntervalMin, 15, 180) * 60 * 1000;

      const existing = readMinutelyCache();
      if (existing) {
        evaluateMinutelyState(existing, { allowOpen: opts?.allowOpen, showUpdatedHint: false });
      }

      const weatherCache = getWeatherCache();
      const lastFetchAt = weatherCache.minutely?.lastApiFetchAt || 0;
      const lastCriticalFetchAt =
        weatherCache.minutely?.lastCriticalFetchAt || lastCriticalMinutelyFetchAtRef.current || 0;
      let shouldRequestApi = !!opts?.forceApi;
      let triggeredByCriticalWindow = false;
      if (!shouldRequestApi) {
        if (!existing || lastFetchAt <= 0 || nowMs - lastFetchAt >= minutelyApiIntervalMs) {
          shouldRequestApi = true;
        } else {
          const existingStats = computeMinutelyRainStats(existing, nowMs);
          const phase = resolveMinutelyRainPhase(existingStats, minutelyPhaseRef.current);
          const allowCritical = shouldTriggerCriticalRefresh({
            phase,
            leadMinutes: existingStats.leadMinutes,
            remainingMinutes: existingStats.remainingMinutes,
            nowMs,
            lastApiFetchAt: lastFetchAt,
            lastCriticalFetchAt,
            baseIntervalMs: minutelyApiIntervalMs,
          });
          if (allowCritical) {
            shouldRequestApi = true;
            triggeredByCriticalWindow = true;
          }
        }
      }
      if (!shouldRequestApi) return;

      const minResp = await fetchMinutelyPrecip(locationParam);
      if (minResp.error || minResp.code !== "200") return;
      updateMinutelyLastFetch(nowMs);
      if (triggeredByCriticalWindow) {
        lastCriticalMinutelyFetchAtRef.current = nowMs;
        updateMinutelyCriticalFetch(nowMs);
      }

      const incomingCache: MinutelyPrecipCacheLike = {
        updateTime: minResp.updateTime,
        summary: minResp.summary,
        minutely: minResp.minutely,
        fetchedAt: nowMs,
      };

      const incomingStats = computeMinutelyRainStats(incomingCache, nowMs);
      const shouldWriteByDiff =
        !!existing &&
        Math.abs(
          computeMinutelyRainStats(existing, nowMs).probability - incomingStats.probability
        ) >= MINUTELY_PRECIP_DIFF_THRESHOLD_PROB;
      if (!existing || opts?.forceApi || shouldWriteByDiff || incomingStats.hasRain) {
        writeMinutelyCache(minResp, nowMs);
      }
      if (existing) {
        const existingStats = computeMinutelyRainStats(existing, nowMs);
        const becameRaining = !existingStats.isRainingNow && incomingStats.isRainingNow;
        evaluateMinutelyState(incomingCache, {
          allowOpen: opts?.allowOpen,
          showUpdatedHint: !!opts?.showUpdatedHint || shouldWriteByDiff,
          forceRainingPopup: becameRaining,
        });
      } else {
        evaluateMinutelyState(incomingCache, {
          allowOpen: opts?.allowOpen,
          showUpdatedHint: opts?.showUpdatedHint,
        });
      }
    },
    [
      autoRefreshIntervalMin,
      evaluateMinutelyState,
      readMinutelyCache,
      study?.minutelyPrecipEnabled,
      writeMinutelyCache,
    ]
  );

  const tickWeatherReminders = useCallback(() => {
    const now = getAdjustedDate();
    const todayKey = formatDateYYYYMMDD(now);
    const nowMs = now.getTime();

    if (study.airQualityAlertEnabled) {
      const remindedKey = `${AIR_QUALITY_REMINDER_KEY_PREFIX}${todayKey}`;
      if (!safeReadSessionFlag(remindedKey)) {
        const cache = getWeatherCache();
        const indexes = cache.airQuality?.data?.indexes || [];
        const idx =
          indexes.find(
            (x) =>
              typeof x.aqi === "number" &&
              String(x.name || "")
                .toUpperCase()
                .includes("AQI")
          ) ||
          indexes.find((x) => typeof x.aqi === "number") ||
          null;
        const aqi = typeof idx?.aqi === "number" ? idx.aqi : null;
        if (aqi != null && aqi >= 101) {
          safeWriteSessionFlag(remindedKey, true);
          const aqiColor = getAqiColor(aqi);
          const aqiLevel = idx?.category || getAqiLevelText(aqi);
          window.dispatchEvent(
            new CustomEvent("messagePopup:open", {
              detail: {
                id: `weather:airQuality:${todayKey}`,
                type: "weatherForecast",
                title: "空气污染提醒",
                message: (
                  <div>
                    AQI：<span style={{ color: aqiColor, fontWeight: 700 }}>{aqi}</span>
                    {aqiLevel ? `（${aqiLevel}）` : ""}
                  </div>
                ),
              },
            })
          );
        }
      }
    }

    if (study.sunriseSunsetAlertEnabled) {
      const cache = getWeatherCache();
      const astro = cache.astronomySun;
      if (astro?.date === todayKey) {
        const mkEventMs = (hhmm: string) => {
          const parts = hhmm.split(":");
          const hh = Number(parts[0]);
          const mm = Number(parts[1]);
          if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
          const d = getAdjustedDate();
          d.setHours(hh, mm, 0, 0);
          return d.getTime();
        };

        const windowMs = 10 * 60 * 1000;
        const sunrise = typeof astro.data?.sunrise === "string" ? astro.data.sunrise : "";
        const sunset = typeof astro.data?.sunset === "string" ? astro.data.sunset : "";

        const sunriseMs = sunrise ? mkEventMs(sunrise) : null;
        const sunsetMs = sunset ? mkEventMs(sunset) : null;

        if (sunriseMs != null) {
          const remindedKey = `${SUNRISE_REMINDER_KEY_PREFIX}${todayKey}`;
          if (
            !safeReadSessionFlag(remindedKey) &&
            nowMs >= sunriseMs &&
            nowMs - sunriseMs < windowMs
          ) {
            safeWriteSessionFlag(remindedKey, true);
            window.dispatchEvent(
              new CustomEvent("messagePopup:open", {
                detail: {
                  id: `weather:sunrise:${todayKey}`,
                  type: "weatherForecast",
                  title: "日出提醒",
                  message: `日出时间：${sunrise}`,
                },
              })
            );
          }
        }

        if (sunsetMs != null) {
          const remindedKey = `${SUNSET_REMINDER_KEY_PREFIX}${todayKey}`;
          const notifyMs = sunsetMs - 30 * 60 * 1000;
          if (
            !safeReadSessionFlag(remindedKey) &&
            nowMs >= notifyMs &&
            nowMs - notifyMs < windowMs
          ) {
            safeWriteSessionFlag(remindedKey, true);
            window.dispatchEvent(
              new CustomEvent("messagePopup:open", {
                detail: {
                  id: `weather:sunset:${todayKey}`,
                  type: "weatherForecast",
                  title: "日落提醒",
                  message: `太阳要下班啦～ 日落时间：${sunset}`,
                },
              })
            );
          }
        }
      }
    }
  }, [study.airQualityAlertEnabled, study.sunriseSunsetAlertEnabled]);

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
      setRefreshStatus('刷新中');
      localStorage.setItem('weather.refreshStatus', '刷新中');

      const result = await buildWeatherFlow();

      if (!result.coords || !result.weather || result.weather.code !== '200' || !result.weather.now) {
        throw new Error(`天气获取失败: ${result.weather?.code || 'unknown'}`);
      }

      const now = result.weather.now;
      const minutelyAlert = calculateMinutelyPrecipAlert(now);
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
  const initializeWeather = useCallback(
    async (options?: WeatherFlowOptions) => {
      try {
        setLoading(true);
        setError(null);

        // 尝试回显缓存
        const cache = getWeatherCache();
        if (cache.now?.data) {
          const now = cache.now.data.now;
          const locationName = cache.location?.city || "未知";
          if (now) {
            setWeatherData({
              temperature: now.temp ?? "",
              text: now.text ?? "",
              location: locationName,
              icon: mapWeatherToIcon(now.text ?? ""),
            });
            setLoading(false); // 如果有缓存先显示，后面继续请求更新
          }
        }

        // 根据用户设置决定是否请求对应API
        const weatherOptions: WeatherFlowOptions = {
          ...options,
          fetchDaily3d: true, // 三日预报始终请求（用于UI展示）
          fetchAstronomySun: study.sunriseSunsetAlertEnabled, // 仅在开启日出日落提醒时请求
          fetchAirQuality: study.airQualityAlertEnabled, // 仅在开启空气质量提醒时请求
        };

        const result = await buildWeatherFlow(weatherOptions);

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

        // 持久化实时天气快照
        updateWeatherNowSnapshot(result.weather);
        const locationParam = `${result.coords.lon},${result.coords.lat}`;
        if (result.daily3d && !result.daily3d.error) {
          updateDaily3dCache(locationParam, result.daily3d);
        }
        // 仅在请求了日出日落数据时才缓存（根据功能开关）
        if (result.astronomySun && !result.astronomySun.error) {
          updateAstronomySunCache(
            locationParam,
            formatDateYYYYMMDD(getAdjustedDate()),
            result.astronomySun
          );
        }
        // 仅在请求了空气质量数据时才缓存（根据功能开关）
        if (result.airQuality && !result.airQuality.error) {
          updateAirQualityCache(result.coords.lat, result.coords.lon, result.airQuality);
        }

        if (study.classEndForecastEnabled) {
          const cache2 = getWeatherCache();
          const lastFetchAt = cache2.hourly72h?.lastApiFetchAt || 0;
          const withinInterval =
            lastFetchAt > 0 && ts - lastFetchAt < CLASS_END_FORECAST_HOURLY_REFRESH_MS;
          const sameLocation = cache2.hourly72h?.location === locationParam;
          if (!withinInterval || !sameLocation) {
            try {
              const hourlyResp = await fetchWeatherHourly72h(locationParam);
              if (!hourlyResp.error && hourlyResp.code === "200") {
                updateHourly72hLastFetch(ts);
                updateHourly72hCache(locationParam, hourlyResp, ts);
              }
            } catch (e) {
              logger.warn("小时预报拉取失败:", e);
            }
          }
        }

        // 广播刷新完成事件
        const geoDiag = getWeatherCache().geolocation?.diagnostics || null;
        const event = new CustomEvent("weatherRefreshDone", {
          detail: {
            status: "成功",
            address,
            ts,
            coords: result.coords || null,
            coordsSource: result.coordsSource || null,
            geolocationDiagnostics: geoDiag,
            now,
            refer: result.weather?.refer || null,
            daily3d: result.daily3d || null,
            astronomySun: result.astronomySun || null,
            airQuality: result.airQuality || null,
          },
        });
        window.dispatchEvent(event);
        showErrorPopupRef.current = false;
      } catch (error) {
        logger.error("天气初始化失败:", error);
        const errorMessage = error instanceof Error ? error.message : "未知错误";
        setError(errorMessage);
        maybeOpenErrorPopup("天气获取失败", errorMessage);

        const cache = getWeatherCache();
        const event = new CustomEvent("weatherRefreshDone", {
          detail: {
            status: "失败",
            errorMessage,
            address: cache.location?.address || "",
            ts: Date.now(),
            coords: cache.coords ? { lat: cache.coords.lat, lon: cache.coords.lon } : null,
            coordsSource: cache.coords?.source || null,
            geolocationDiagnostics: cache.geolocation?.diagnostics || null,
          },
        });
        window.dispatchEvent(event);
      } finally {
        setLoading(false);
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
        localStorage.setItem('weather.minutely.level', minutelyAlert.level);
        localStorage.setItem('weather.minutely.probability', String(minutelyAlert.probability));
        localStorage.setItem('weather.minutely.expectedMm', String(minutelyAlert.expectedMm));
        localStorage.setItem('weather.minutely.shouldAlert', String(minutelyAlert.shouldAlert));
        localStorage.setItem('weather.minutely.reason', minutelyAlert.reason);
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
          minutelyAlert,
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
    },
    [
      mapWeatherToIcon,
      maybeOpenErrorPopup,
      study.classEndForecastEnabled,
      study.airQualityAlertEnabled,
      study.sunriseSunsetAlertEnabled,
    ]
  );

  /**
   * 仅刷新定位信息（函数级中文注释）：
   * - 只更新坐标与地址缓存，不触发天气接口请求；
   * - 用于设置页“自动模式-刷新定位”按钮。
   */
  const refreshLocationOnly = useCallback(
    async (options?: WeatherFlowOptions) => {
      try {
        const result = await buildLocationFlow(options);
        const cache = getWeatherCache();
        const geoDiag = cache.geolocation?.diagnostics || null;
        const event = new CustomEvent(WEATHER_LOCATION_REFRESH_DONE_EVENT, {
          detail: {
            status: result.coords ? "成功" : "失败",
            errorMessage: result.coords ? "" : "定位失败",
            address: cache.location?.address || "",
            ts: Date.now(),
            coords: result.coords || null,
            coordsSource: result.coordsSource || null,
            geolocationDiagnostics: geoDiag,
          },
        });
        window.dispatchEvent(event);
        showErrorPopupRef.current = false;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "未知错误";
        maybeOpenErrorPopup("定位失败", errorMessage);
        const cache = getWeatherCache();
        const event = new CustomEvent(WEATHER_LOCATION_REFRESH_DONE_EVENT, {
          detail: {
            status: "失败",
            errorMessage,
            address: cache.location?.address || "",
            ts: Date.now(),
            coords: cache.coords ? { lat: cache.coords.lat, lon: cache.coords.lon } : null,
            coordsSource: cache.coords?.source || null,
            geolocationDiagnostics: cache.geolocation?.diagnostics || null,
          },
        });
        window.dispatchEvent(event);
      }
    },
    [maybeOpenErrorPopup]
  );

  /**
   * 处理天气预警与降雨提醒
   */
  const handleAlertsAndPrecip = useCallback(
    async (coords?: { lat: number; lon: number } | null) => {
      if (!coords) return;
      const locationParam = `${coords.lon},${coords.lat}`;
      try {
        if (study.weatherAlertEnabled) {
          const alertResp = await fetchWeatherAlertsByCoords(coords.lat, coords.lon);
          if (
            !alertResp.error &&
            alertResp.alerts &&
            alertResp.alerts.length > 0 &&
            !alertResp.metadata?.zeroResult
          ) {
            const {
              selectLatestAlertsPerStation,
              buildAlertSignature,
              normalizeStationKey,
              readStationRecord,
              writeStationRecord,
            } = await import("../../utils/weatherAlert");
            const latestByStation = selectLatestAlertsPerStation(alertResp.alerts);
            for (const item of latestByStation) {
              const stationKey = normalizeStationKey(item.alert.senderName, coords);
              const signature = buildAlertSignature(item.alert);
              const record = readStationRecord(stationKey);
              if (record && record.sig === signature) {
                continue;
              }
              writeStationRecord(stationKey, signature);
              const themeColor = mapWeatherAlertColorToThemeColor(item.alert.color?.code);
              const ev = new CustomEvent("messagePopup:open", {
                detail: {
                  type: "weatherAlert",
                  title:
                    item.alert.headline ||
                    (item.alert.eventType?.name ? `${item.alert.eventType.name}预警` : "天气预警"),
                  message: item.alert.description || "请注意当前天气预警信息。",
                  themeColor,
                },
              });
              window.dispatchEvent(ev);
            }
            if (latestByStation.length === 0 && alertResp.metadata?.tag) {
              const cache = getWeatherCache();
              const lastTag = cache.alertMetadata?.lastTag;

              if (alertResp.metadata.tag !== lastTag) {
                updateAlertTag(alertResp.metadata.tag);
                const first = alertResp.alerts[0];
                const themeColor = mapWeatherAlertColorToThemeColor(first.color?.code);
                const ev = new CustomEvent("messagePopup:open", {
                  detail: {
                    type: "weatherAlert",
                    title:
                      first.headline ||
                      (first.eventType?.name ? `${first.eventType.name}预警` : "天气预警"),
                    message: first.description || "请注意当前天气预警信息。",
                    themeColor,
                  },
                });
                window.dispatchEvent(ev);
              }
            }
          }
        }
      } catch (e) {
        logger.warn("天气预警处理失败:", e);
      }

      try {
        if (study.minutelyPrecipEnabled) {
          const dismissed = safeReadSessionFlag(MINUTELY_PRECIP_POPUP_DISMISSED_KEY);
          await refreshMinutelyPrecip(locationParam, {
            forceApi: false,
            allowOpen: !dismissed,
          });
        }
      } catch (e) {
        logger.warn("分钟级降水处理失败:", e);
      }

      tickWeatherReminders();
    },
    [refreshMinutelyPrecip, study, tickWeatherReminders]
  );

  /**
   * 组件挂载时初始化天气数据
   */
  useEffect(() => {
    void initializeWeather();
    tickWeatherReminders();
    recomputeMinutelyPrecipLocally({ allowOpen: true });

    const intervalMs = clampInt(autoRefreshIntervalMin, 15, 180) * 60 * 1000;
    const interval = setInterval(() => void initializeWeather(), intervalMs);
    const localMinutelyTickInterval = setInterval(() => {
      recomputeMinutelyPrecipLocally({ allowOpen: true });
      tickWeatherReminders();
    }, MINUTELY_PRECIP_LOCAL_TICK_MS);

    // 监听天气刷新事件
    const handleWeatherRefresh = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      showErrorPopupRef.current = detail.showErrorPopup === true;
      const preferredLocationMode =
        detail.preferredLocationMode === "auto" || detail.preferredLocationMode === "manual"
          ? (detail.preferredLocationMode as "auto" | "manual")
          : undefined;
      void initializeWeather({ preferredLocationMode });
    };

    window.addEventListener("weatherRefresh", handleWeatherRefresh);
    const handleLocationRefresh = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      showErrorPopupRef.current = detail.showErrorPopup === true;
      const preferredLocationMode =
        detail.preferredLocationMode === "auto" || detail.preferredLocationMode === "manual"
          ? (detail.preferredLocationMode as "auto" | "manual")
          : undefined;
      void refreshLocationOnly({ preferredLocationMode, forceGeolocation: true });
    };
    window.addEventListener(WEATHER_LOCATION_REFRESH_EVENT, handleLocationRefresh);
    const handleMinutelyManualRefresh = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const forceApi = detail.forceApi === true;
      const allowOpen = detail.openIfRain === true || detail.allowOpen === true;
      const showUpdatedHint = detail.showUpdatedHint === true;

      const coords = getValidCoords();
      if (!coords) return;

      const locationParam = `${coords.lon},${coords.lat}`;
      refreshMinutelyPrecip(locationParam, {
        forceApi,
        allowOpen,
        showUpdatedHint,
      });
    };
    window.addEventListener(
      MINUTELY_PRECIP_MANUAL_REFRESH_EVENT,
      handleMinutelyManualRefresh as EventListener
    );
    const onDone = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      handleAlertsAndPrecip(detail.coords || null);
    };
    window.addEventListener("weatherRefreshDone", onDone as EventListener);

    return () => {
      clearInterval(interval);
      clearInterval(localMinutelyTickInterval);
      window.removeEventListener("weatherRefresh", handleWeatherRefresh);
      window.removeEventListener(WEATHER_LOCATION_REFRESH_EVENT, handleLocationRefresh);
      window.removeEventListener(
        MINUTELY_PRECIP_MANUAL_REFRESH_EVENT,
        handleMinutelyManualRefresh as EventListener
      );
      window.removeEventListener("weatherRefreshDone", onDone as EventListener);
    };
  }, [
    autoRefreshIntervalMin,
    initializeWeather,
    refreshLocationOnly,
    handleAlertsAndPrecip,
    refreshMinutelyPrecip,
    recomputeMinutelyPrecipLocally,
    tickWeatherReminders,
  ]);

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

  const displayTempText = !error && weatherData?.temperature ? `${weatherData.temperature}°` : "--";
  const displayTextRaw = !error && weatherData?.text ? weatherData.text : "--";
  const displayIconCode = !error && weatherData?.icon ? weatherData.icon : null;
  const titleText =
    !error && weatherData ? `${weatherData.text} ${weatherData.temperature}°C` : "--";

  return (
    <div className={styles.weather} title={titleText}>
      <div className={styles.temperature}>{displayTempText}</div>
      <div className={styles.divider}></div>
      <div className={styles.icon}>
        {displayIconCode ? (
          <img
            src={getWeatherIconUrl(displayIconCode)}
            alt={displayTextRaw}
            loading="lazy"
            decoding="async"
            className={styles.weatherIcon}
          />
        ) : null}
      </div>
      <div className={styles.weatherText}>
        {displayTextRaw === "--" ? "--" : getSimplifiedWeatherText(displayTextRaw)}
      </div>
    </div>
  );
};

export default Weather;
