import React, { useState, useEffect, useCallback } from "react";

import { useAppState } from "../../contexts/AppContext";
import {
  buildWeatherFlow,
  fetchWeatherAlertsByCoords,
  fetchMinutelyPrecip,
} from "../../services/weatherService";
import type { MinutelyPrecipResponse } from "../../services/weatherService";
import { logger } from "../../utils/logger";

import styles from "./Weather.module.css";

const MINUTELY_PRECIP_POPUP_ID = "weather:minutelyPrecip";
const MINUTELY_PRECIP_CACHE_KEY = "weather.minutely.cache.v1";
const MINUTELY_PRECIP_API_LAST_FETCH_AT_KEY = "weather.minutely.lastApiFetchAt";
const MINUTELY_PRECIP_POPUP_SHOWN_KEY = "weather.minutely.popupShown";
const MINUTELY_PRECIP_POPUP_OPEN_KEY = "weather.minutely.popupOpen";
const MINUTELY_PRECIP_POPUP_DISMISSED_KEY = "weather.minutely.popupDismissed";
const MINUTELY_PRECIP_API_INTERVAL_MS = 30 * 60 * 1000;
const MINUTELY_PRECIP_DIFF_THRESHOLD_PROB = 10;

type MinutelyPrecipCache = Pick<MinutelyPrecipResponse, "updateTime" | "summary" | "minutely"> & {
  fetchedAt: number;
};

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
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

  const readMinutelyCache = useCallback((): MinutelyPrecipCache | null => {
    const raw = localStorage.getItem(MINUTELY_PRECIP_CACHE_KEY);
    return safeParseJson<MinutelyPrecipCache>(raw);
  }, []);

  const writeMinutelyCache = useCallback((data: MinutelyPrecipResponse, fetchedAt: number) => {
    const payload: MinutelyPrecipCache = {
      updateTime: data.updateTime,
      summary: data.summary,
      minutely: data.minutely,
      fetchedAt,
    };
    try {
      localStorage.setItem(MINUTELY_PRECIP_CACHE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
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
          <div>{opts?.showUpdatedHint ? `${stats.summary}（已更新）` : stats.summary}</div>
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
              const lastTag = localStorage.getItem("weather.alert.lastTag");
              if (alertResp.metadata.tag !== lastTag) {
                localStorage.setItem("weather.alert.lastTag", alertResp.metadata.tag);
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
          updateMinutelyPopupFromCache();

          const nowMs = Date.now();
          const lastFetchAtRaw = localStorage.getItem(MINUTELY_PRECIP_API_LAST_FETCH_AT_KEY) || "0";
          const lastFetchAt = Number.parseInt(lastFetchAtRaw, 10);
          if (
            Number.isFinite(lastFetchAt) &&
            lastFetchAt > 0 &&
            nowMs - lastFetchAt < MINUTELY_PRECIP_API_INTERVAL_MS
          ) {
            return;
          }
          localStorage.setItem(MINUTELY_PRECIP_API_LAST_FETCH_AT_KEY, String(nowMs));

          const minResp = await fetchMinutelyPrecip(locationParam);
          if (!minResp.error && minResp.code === "200") {
            const incomingCache: MinutelyPrecipCache = {
              updateTime: minResp.updateTime,
              summary: minResp.summary,
              minutely: minResp.minutely,
              fetchedAt: nowMs,
            };

            const existing = readMinutelyCache();
            const dismissed = safeReadSessionFlag(MINUTELY_PRECIP_POPUP_DISMISSED_KEY);
            const shown = safeReadSessionFlag(MINUTELY_PRECIP_POPUP_SHOWN_KEY);
            const incomingStats = computeMinutelyRainStats(incomingCache, nowMs);

            if (!existing) {
              writeMinutelyCache(minResp, nowMs);
            }

            if (!shown && !dismissed && incomingStats.hasRain) {
              const message = buildMinutelyPopupMessage(incomingCache);
              safeWriteSessionFlag(MINUTELY_PRECIP_POPUP_SHOWN_KEY, true);
              safeWriteSessionFlag(MINUTELY_PRECIP_POPUP_OPEN_KEY, true);
              const ev = new CustomEvent("messagePopup:open", {
                detail: {
                  id: MINUTELY_PRECIP_POPUP_ID,
                  type: "weatherAlert",
                  title: "降雨提醒",
                  message,
                },
              });
              window.dispatchEvent(ev);
            }

            if (existing) {
              const existingStats = computeMinutelyRainStats(existing, nowMs);
              const diffProb = Math.abs(existingStats.probability - incomingStats.probability);
              if (diffProb >= MINUTELY_PRECIP_DIFF_THRESHOLD_PROB) {
                writeMinutelyCache(minResp, nowMs);
                updateMinutelyPopupFromCache({ showUpdatedHint: true });
              } else {
                updateMinutelyPopupFromCache();
              }
            }
          }
        }
      } catch (e) {
        logger.warn("分钟级降水处理失败:", e);
      }
    },
    [
      buildMinutelyPopupMessage,
      readMinutelyCache,
      study,
      updateMinutelyPopupFromCache,
      writeMinutelyCache,
    ]
  );

  /**
   * 组件挂载时初始化天气数据
   */
  useEffect(() => {
    initializeWeather();

    // 每30分钟更新一次天气数据
    const interval = setInterval(initializeWeather, 30 * 60 * 1000);
    const localMinutelyInterval = setInterval(() => updateMinutelyPopupFromCache(), 30 * 60 * 1000);
    const localMinutelyTickInterval = setInterval(() => updateMinutelyPopupFromCache(), 60 * 1000);

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
      clearInterval(localMinutelyInterval);
      clearInterval(localMinutelyTickInterval);
      window.removeEventListener("weatherRefresh", handleWeatherRefresh);
      window.removeEventListener("weatherRefreshDone", onDone as EventListener);
    };
  }, [initializeWeather, handleAlertsAndPrecip, updateMinutelyPopupFromCache]);

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
