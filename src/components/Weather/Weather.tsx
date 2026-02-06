import React, { useState, useEffect, useCallback } from "react";

import { useAppState } from "../../contexts/AppContext";
import {
  buildWeatherFlow,
  fetchWeatherAlertsByCoords,
  fetchMinutelyPrecip,
} from "../../services/weatherService";
import { buildLocationFlow } from "../../services/locationService";
import type { MinutelyPrecipResponse } from "../../types/weather";
import type { WeatherFlowOptions } from "../../services/weatherService";
import { logger } from "../../utils/logger";
import { getAppSettings } from "../../utils/appSettings";
import { SETTINGS_EVENTS, subscribeSettingsEvent } from "../../utils/settingsEvents";
import {
  getWeatherCache,
  updateWeatherNowSnapshot,
  updateMinutelyCache,
  getValidMinutely,
  getValidCoords,
  updateMinutelyLastFetch,
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
const MINUTELY_PRECIP_MANUAL_REFRESH_EVENT = "weatherMinutelyPrecipRefresh";
const MINUTELY_PRECIP_DIFF_THRESHOLD_PROB = 10;
const WEATHER_LOCATION_REFRESH_EVENT = "weatherLocationRefresh";
const WEATHER_LOCATION_REFRESH_DONE_EVENT = "weatherLocationRefreshDone";

type MinutelyPrecipCache = Pick<MinutelyPrecipResponse, "updateTime" | "summary" | "minutely"> & {
  fetchedAt: number;
};

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

function formatTimestampHm(ms: number): string {
  const d = new Date(ms);
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${hh}:${mm}`;
}

function parseTimeMs(iso?: string): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

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
    /* ignore */
  }
}

function computeMinutelyRainStats(cache: MinutelyPrecipCache, nowMs: number) {
  const list = cache.minutely || [];
  const baseMs = parseTimeMs(cache.updateTime) ?? cache.fetchedAt ?? nowMs;
  const items = list
    .map((m, idx) => {
      const t = parseTimeMs(m.fxTime) ?? baseMs + idx * 5 * 60 * 1000;
      const p = m.precip ? Number.parseFloat(m.precip) : 0;
      const precip = Number.isFinite(p) ? p : 0;
      return { t, precip };
    })
    .sort((a, b) => a.t - b.t);

  const slotMs = 5 * 60 * 1000;
  const idxNow = (() => {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i].t <= nowMs) return i;
    }
    return -1;
  })();
  const currentItem =
    idxNow >= 0 && nowMs - items[idxNow].t < slotMs ? items[idxNow] : (null as null);
  const rainingNow = !!currentItem && currentItem.precip > 0;

  const horizon = items.filter((x) => x.t >= nowMs);
  const horizonWithNow = rainingNow && currentItem ? [currentItem, ...horizon] : horizon;
  const totalSlots = horizonWithNow.length > 0 ? horizonWithNow.length : items.length;
  const rainySlots = (horizonWithNow.length > 0 ? horizonWithNow : items).filter(
    (x) => x.precip > 0
  );
  const probability = totalSlots > 0 ? Math.round((rainySlots.length / totalSlots) * 100) : 0;

  if (rainySlots.length === 0) {
    return {
      hasRain: false,
      probability,
      intensityLabel: "降雨",
      startInMinutes: null as number | null,
      durationMinutes: null as number | null,
      remainingMinutes: null as number | null,
      expectedAmountMm: 0,
      summary: "未来两小时暂无降雨。",
    };
  }

  if (rainingNow && currentItem && idxNow >= 0) {
    let segStart = idxNow;
    while (segStart - 1 >= 0 && items[segStart - 1].precip > 0) segStart -= 1;
    let segEnd = idxNow;
    while (segEnd + 1 < items.length && items[segEnd + 1].precip > 0) segEnd += 1;

    const segment = items.slice(segStart, segEnd + 1);
    const durationMinutes = segment.length > 0 ? segment.length * 5 : 5;
    const maxPrecip = segment.reduce((mx, x) => Math.max(mx, x.precip), 0);
    const expectedAmountMm = items.slice(idxNow, segEnd + 1).reduce((sum, x) => sum + x.precip, 0);

    const intensityLabel =
      maxPrecip < 0.1 ? "小雨" : maxPrecip < 0.5 ? "中雨" : maxPrecip < 1.5 ? "大雨" : "暴雨";

    const segmentEndMs = items[segEnd].t + slotMs;
    const remainingMinutes = Math.max(0, Math.round((segmentEndMs - nowMs) / 60000));

    const summary = `正在${intensityLabel}，预计${remainingMinutes}分钟后结束。`;
    return {
      hasRain: true,
      probability,
      intensityLabel,
      startInMinutes: 0,
      durationMinutes,
      remainingMinutes,
      expectedAmountMm,
      summary,
    };
  }

  const firstRain = rainySlots[0];
  const startInMinutes = Math.max(0, Math.round((firstRain.t - nowMs) / 60000));

  const seqSource = horizon.length > 0 ? horizon : items;
  const firstIdx = seqSource.findIndex((x) => x.t === firstRain.t && x.precip > 0);
  const segment: Array<{ t: number; precip: number }> = [];
  for (let i = Math.max(0, firstIdx); i < seqSource.length; i += 1) {
    const x = seqSource[i];
    if (x.precip > 0) segment.push(x);
    else if (segment.length > 0) break;
  }

  const durationMinutes = segment.length > 0 ? segment.length * 5 : 5;
  const maxPrecip = segment.reduce((mx, x) => Math.max(mx, x.precip), 0);
  const expectedAmountMm = segment.reduce((sum, x) => sum + x.precip, 0);

  const intensityLabel =
    maxPrecip < 0.1 ? "小雨" : maxPrecip < 0.5 ? "中雨" : maxPrecip < 1.5 ? "大雨" : "暴雨";

  const lastSegmentItem = segment.length > 0 ? segment[segment.length - 1] : null;
  const segmentEndMs = ((lastSegmentItem ? lastSegmentItem.t : null) ?? firstRain.t) + slotMs;
  const remainingMinutes =
    nowMs >= firstRain.t ? Math.max(0, Math.round((segmentEndMs - nowMs) / 60000)) : null;

  const summary =
    startInMinutes > 0
      ? `预计${startInMinutes}分钟后开始${intensityLabel}，持续约${durationMinutes}分钟。`
      : `正在${intensityLabel}，预计${remainingMinutes ?? durationMinutes}分钟后结束。`;

  return {
    hasRain: true,
    probability,
    intensityLabel,
    startInMinutes,
    durationMinutes,
    remainingMinutes,
    expectedAmountMm,
    summary,
  };
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
  const [autoRefreshIntervalMin, setAutoRefreshIntervalMin] = useState<number>(() => {
    return clampInt(getAppSettings().general.weather.autoRefreshIntervalMin, 15, 180);
  });

  useEffect(() => {
    const updateInterval = () => {
      setAutoRefreshIntervalMin(clampInt(getAppSettings().general.weather.autoRefreshIntervalMin, 15, 180));
    };
    const offSaved = subscribeSettingsEvent(SETTINGS_EVENTS.SettingsSaved, updateInterval);
    const offWeather = subscribeSettingsEvent(SETTINGS_EVENTS.WeatherSettingsUpdated, updateInterval);
    return () => {
      offSaved();
      offWeather();
    };
  }, []);

  const readMinutelyCache = useCallback((): MinutelyPrecipCache | null => {
    const coords = getValidCoords();
    if (coords) {
      const location = `${coords.lon.toFixed(2)},${coords.lat.toFixed(2)}`;
      const data = getValidMinutely(location);
      if (data) {
        return {
          updateTime: data.updateTime,
          summary: data.summary,
          minutely: data.minutely,
          fetchedAt: Date.now(),
        };
      }
    }
    return null;
  }, []);

  const writeMinutelyCache = useCallback((data: MinutelyPrecipResponse, _fetchedAt: number) => {
    const coords = getValidCoords();
    if (coords) {
      const location = `${coords.lon.toFixed(2)},${coords.lat.toFixed(2)}`;
      updateMinutelyCache(location, data);
    }
  }, []);

  const buildMinutelyPopupMessage = useCallback(
    (
      cache: MinutelyPrecipCache,
      opts?: {
        showUpdatedHint?: boolean;
      }
    ): React.ReactNode => {
      const nowMs = Date.now();
      const stats = computeMinutelyRainStats(cache, nowMs);
      const lastUpdateMs = parseTimeMs(cache.updateTime) ?? cache.fetchedAt ?? nowMs;
      const lastUpdateText = formatTimestampHm(lastUpdateMs);

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div>{opts?.showUpdatedHint ? `${stats.summary}` : stats.summary}</div>
          <div>降雨概率：{stats.probability}%</div>
          <div style={{ opacity: 0.8, fontSize: "0.72rem" }}>上次更新：{lastUpdateText}</div>
        </div>
      );
    },
    []
  );

  const updateMinutelyPopupFromCache = useCallback(
    (opts?: { showUpdatedHint?: boolean }) => {
      if (!study?.messagePopupEnabled || !study.minutelyPrecipEnabled) return;
      if (!safeReadSessionFlag(MINUTELY_PRECIP_POPUP_OPEN_KEY)) return;
      if (safeReadSessionFlag(MINUTELY_PRECIP_POPUP_DISMISSED_KEY)) return;

      const cache = readMinutelyCache();
      if (!cache) return;
      const message = buildMinutelyPopupMessage(cache, { showUpdatedHint: opts?.showUpdatedHint });
      const ev = new CustomEvent("messagePopup:open", {
        detail: {
          id: MINUTELY_PRECIP_POPUP_ID,
          type: "weatherAlert",
          title: "降雨提醒",
          message,
        },
      });
      window.dispatchEvent(ev);
    },
    [
      buildMinutelyPopupMessage,
      readMinutelyCache,
      study?.messagePopupEnabled,
      study?.minutelyPrecipEnabled,
    ]
  );

  const refreshMinutelyPrecip = useCallback(
    async (
      locationParam: string,
      opts?: {
        forceApi?: boolean;
        openIfRain?: boolean;
        showUpdatedHint?: boolean;
      }
    ) => {
      if (!study?.messagePopupEnabled || !study.minutelyPrecipEnabled) return;

      const nowMs = Date.now();
      const minutelyApiIntervalMs = clampInt(autoRefreshIntervalMin, 15, 180) * 60 * 1000;

      const openPopupIfEligible = (cache: MinutelyPrecipCache) => {
        if (!opts?.openIfRain) return;
        if (safeReadSessionFlag(MINUTELY_PRECIP_POPUP_DISMISSED_KEY)) return;
        if (safeReadSessionFlag(MINUTELY_PRECIP_POPUP_SHOWN_KEY)) return;
        const stats = computeMinutelyRainStats(cache, nowMs);
        if (!stats.hasRain) return;
        safeWriteSessionFlag(MINUTELY_PRECIP_POPUP_SHOWN_KEY, true);
        safeWriteSessionFlag(MINUTELY_PRECIP_POPUP_OPEN_KEY, true);
        const message = buildMinutelyPopupMessage(cache, {
          showUpdatedHint: !!opts?.showUpdatedHint,
        });
        const ev = new CustomEvent("messagePopup:open", {
          detail: {
            id: MINUTELY_PRECIP_POPUP_ID,
            type: "weatherAlert",
            title: "降雨提醒",
            message,
          },
        });
        window.dispatchEvent(ev);
      };

      updateMinutelyPopupFromCache();
      const existing = readMinutelyCache();
      if (existing) {
        openPopupIfEligible(existing);
      }

      if (!opts?.forceApi) {
        const cache = getWeatherCache();
        const lastFetchAt = cache.minutely?.lastApiFetchAt || 0;
        if (lastFetchAt > 0 && nowMs - lastFetchAt < minutelyApiIntervalMs) {
          return;
        }
      }

      const minResp = await fetchMinutelyPrecip(locationParam);
      if (minResp.error || minResp.code !== "200") return;
      updateMinutelyLastFetch(nowMs);

      const incomingCache: MinutelyPrecipCache = {
        updateTime: minResp.updateTime,
        summary: minResp.summary,
        minutely: minResp.minutely,
        fetchedAt: nowMs,
      };

      const incomingStats = computeMinutelyRainStats(incomingCache, nowMs);

      if (!existing || opts?.forceApi) {
        writeMinutelyCache(minResp, nowMs);
      }

      if (incomingStats.hasRain) {
        openPopupIfEligible(incomingCache);
      }

      if (existing) {
        const existingStats = computeMinutelyRainStats(existing, nowMs);
        const diffProb = Math.abs(existingStats.probability - incomingStats.probability);
        const exceedThreshold = diffProb >= MINUTELY_PRECIP_DIFF_THRESHOLD_PROB;
        if (exceedThreshold) {
          writeMinutelyCache(minResp, nowMs);
          updateMinutelyPopupFromCache({ showUpdatedHint: true });
        } else if (opts?.showUpdatedHint) {
          updateMinutelyPopupFromCache({ showUpdatedHint: true });
        } else {
          updateMinutelyPopupFromCache();
        }
      } else if (opts?.showUpdatedHint) {
        updateMinutelyPopupFromCache({ showUpdatedHint: true });
      } else {
        updateMinutelyPopupFromCache();
      }
    },
    [
      autoRefreshIntervalMin,
      buildMinutelyPopupMessage,
      readMinutelyCache,
      study?.messagePopupEnabled,
      study?.minutelyPrecipEnabled,
      updateMinutelyPopupFromCache,
      writeMinutelyCache,
    ]
  );

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
  const initializeWeather = useCallback(async (options?: WeatherFlowOptions) => {
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

      const result = await buildWeatherFlow(options);

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
      if (result.astronomySun && !result.astronomySun.error) {
        updateAstronomySunCache(locationParam, formatDateYYYYMMDD(new Date()), result.astronomySun);
      }
      if (result.airQuality && !result.airQuality.error) {
        updateAirQualityCache(result.coords.lat, result.coords.lon, result.airQuality);
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
    } catch (error) {
      logger.error("天气初始化失败:", error);
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      setError(errorMessage);

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
  }, [mapWeatherToIcon]);

  /**
   * 仅刷新定位信息（函数级中文注释）：
   * - 只更新坐标与地址缓存，不触发天气接口请求；
   * - 用于设置页“自动模式-刷新定位”按钮。
   */
  const refreshLocationOnly = useCallback(async (options?: WeatherFlowOptions) => {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
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
  }, []);

  /**
   * 处理天气预警与降雨提醒
   */
  const handleAlertsAndPrecip = useCallback(
    async (coords?: { lat: number; lon: number } | null) => {
      if (!coords || !study?.messagePopupEnabled) return;
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
              const ev = new CustomEvent("messagePopup:open", {
                detail: {
                  type: "weatherAlert",
                  title:
                    item.alert.headline ||
                    (item.alert.eventType?.name ? `${item.alert.eventType.name}预警` : "天气预警"),
                  message: item.alert.description || "请注意当前天气预警信息。",
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
                const ev = new CustomEvent("messagePopup:open", {
                  detail: {
                    type: "weatherAlert",
                    title:
                      first.headline ||
                      (first.eventType?.name ? `${first.eventType.name}预警` : "天气预警"),
                    message: first.description || "请注意当前天气预警信息。",
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
          const shown = safeReadSessionFlag(MINUTELY_PRECIP_POPUP_SHOWN_KEY);
          await refreshMinutelyPrecip(locationParam, {
            forceApi: false,
            openIfRain: !shown && !dismissed,
          });
        }
      } catch (e) {
        logger.warn("分钟级降水处理失败:", e);
      }
    },
    [refreshMinutelyPrecip, study]
  );

  /**
   * 组件挂载时初始化天气数据
   */
  useEffect(() => {
    void initializeWeather();

    const intervalMs = clampInt(autoRefreshIntervalMin, 15, 180) * 60 * 1000;
    const interval = setInterval(() => void initializeWeather(), intervalMs);
    const localMinutelyInterval = setInterval(() => updateMinutelyPopupFromCache(), intervalMs);
    const localMinutelyTickInterval = setInterval(() => updateMinutelyPopupFromCache(), 60 * 1000);

    // 监听天气刷新事件
    const handleWeatherRefresh = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const preferredLocationMode =
        detail.preferredLocationMode === "auto" || detail.preferredLocationMode === "manual"
          ? (detail.preferredLocationMode as "auto" | "manual")
          : undefined;
      void initializeWeather({ preferredLocationMode });
    };

    window.addEventListener("weatherRefresh", handleWeatherRefresh);
    const handleLocationRefresh = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
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
      const openIfRain = detail.openIfRain === true;
      const showUpdatedHint = detail.showUpdatedHint === true;

      const coords = getValidCoords();
      if (!coords) return;

      const locationParam = `${coords.lon},${coords.lat}`;
      refreshMinutelyPrecip(locationParam, {
        forceApi,
        openIfRain,
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
      clearInterval(localMinutelyInterval);
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
    updateMinutelyPopupFromCache,
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
