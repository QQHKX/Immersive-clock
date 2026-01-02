import { WeatherNow, MinutelyPrecipResponse } from "../services/weatherService";

import { logger } from "./logger";

const STORAGE_KEY = "weather-cache";

// 缓存有效期常量
const COORDS_TTL = 12 * 60 * 60 * 1000; // 12小时
const LOCATION_TTL = 12 * 60 * 60 * 1000; // 12小时
const ALERT_TTL = 12 * 60 * 60 * 1000; // 12小时
const MINUTELY_TTL = 5 * 60 * 1000; // 5分钟

export interface WeatherCache {
  // 1. 坐标与定位缓存
  coords?: {
    lat: number;
    lon: number;
    source: string; // 'geolocation' | 'amap_ip' | 'ip'
    updatedAt: number;
  };

  // 2. 城市与地址缓存 (依赖坐标)
  location?: {
    city?: string;
    locationId?: string;
    address?: string;
    addressSource?: string;
    signature: string; // lat,lon 的签名
    updatedAt: number;
  };

  // 3. 实时天气快照 (用于回显)
  now?: {
    data: WeatherNow;
    updatedAt: number;
  };

  // 4. 分钟级降水缓存
  minutely?: {
    data: MinutelyPrecipResponse;
    location: string; // "lon,lat"
    updatedAt: number;
    lastApiFetchAt?: number; // 上次API请求时间
  };

  // 5. 预警去重记录 (Map 结构序列化)
  alerts?: Record<string, { sig: string; ts: number }>; // 键名为 stationKey

  // 6. 预警元数据
  alertMetadata?: {
    lastTag?: string; // 预警数据的 tag，用于检测变化
  };
}

/**
 * 获取完整天气缓存
 */
export function getWeatherCache(): WeatherCache {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    logger.warn("Failed to read weather cache", error);
    return {};
  }
}

/**
 * 保存部分天气缓存
 */
function saveWeatherCache(
  partial: Partial<WeatherCache> | ((current: WeatherCache) => Partial<WeatherCache>)
) {
  try {
    const current = getWeatherCache();
    const updates = typeof partial === "function" ? partial(current) : partial;
    const next = { ...current, ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    logger.error("Failed to save weather cache", error);
  }
}

/**
 * 更新坐标缓存
 */
export function updateCoordsCache(lat: number, lon: number, source: string) {
  saveWeatherCache({
    coords: {
      lat,
      lon,
      source,
      updatedAt: Date.now(),
    },
  });
}

/**
 * 更新位置信息缓存 (城市/地址)
 */
export function updateLocationCache(
  lat: number,
  lon: number,
  data: {
    city?: string;
    locationId?: string;
    address?: string;
    addressSource?: string;
  }
) {
  // 仅当提供了有效数据时才更新，保留旧字段
  saveWeatherCache((current) => {
    const signature = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    // 修复：显式为回退对象标注类型，以便安全访问其属性
    const existing = (current.location?.signature === signature
      ? current.location
      : {}) as Partial<NonNullable<WeatherCache["location"]>>;

    return {
      location: {
        signature,
        updatedAt: Date.now(),
        city: data.city ?? existing.city,
        locationId: data.locationId ?? existing.locationId,
        address: data.address ?? existing.address,
        addressSource: data.addressSource ?? existing.addressSource,
      },
    };
  });
}

/**
 * 更新实时天气快照
 */
export function updateWeatherNowSnapshot(data: WeatherNow) {
  saveWeatherCache({
    now: {
      data,
      updatedAt: Date.now(),
    },
  });
}

/**
 * 更新分钟级降水缓存
 */
export function updateMinutelyCache(
  location: string,
  data: MinutelyPrecipResponse,
  lastApiFetchAt?: number
) {
  saveWeatherCache((current) => {
    return {
      minutely: {
        data,
        location,
        updatedAt: Date.now(),
        lastApiFetchAt: lastApiFetchAt ?? current.minutely?.lastApiFetchAt,
      },
    };
  });
}

/**
 * 更新分钟级降水API最后请求时间
 */
export function updateMinutelyLastFetch(lastApiFetchAt: number) {
  saveWeatherCache((current) => {
    if (!current.minutely) return {};
    return {
      minutely: {
        ...current.minutely,
        lastApiFetchAt,
      },
    };
  });
}

/**
 * 更新预警 Tag
 */
export function updateAlertTag(tag: string) {
  saveWeatherCache({
    alertMetadata: {
      lastTag: tag,
    },
  });
}

/**
 * 读取并清理过期的坐标缓存
 */
export function getValidCoords() {
  const cache = getWeatherCache();
  if (cache.coords && Date.now() - cache.coords.updatedAt < COORDS_TTL) {
    return cache.coords;
  }
  return null;
}

/**
 * 读取并清理过期的位置缓存
 */
export function getValidLocation(lat: number, lon: number) {
  const cache = getWeatherCache();
  const signature = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (
    cache.location &&
    cache.location.signature === signature &&
    Date.now() - cache.location.updatedAt < LOCATION_TTL
  ) {
    return cache.location;
  }
  return null;
}

/**
 * 读取有效的分钟级降水缓存
 */
export function getValidMinutely(location: string) {
  const cache = getWeatherCache();
  if (
    cache.minutely &&
    cache.minutely.location === location &&
    Date.now() - cache.minutely.updatedAt < MINUTELY_TTL
  ) {
    return cache.minutely.data;
  }
  return null;
}

/**
 * 读取站点预警记录
 */
export function readStationAlertRecord(stationKey: string) {
  const cache = getWeatherCache();
  const record = cache.alerts?.[stationKey];
  if (record && Date.now() - record.ts < ALERT_TTL) {
    return record;
  }
  return null;
}

/**
 * 写入站点预警记录
 */
export function writeStationAlertRecord(stationKey: string, sig: string) {
  saveWeatherCache((current) => {
    const alerts = current.alerts || {};
    // 简单的内存清理：移除过期记录
    const now = Date.now();
    const cleanAlerts: Record<string, { sig: string; ts: number }> = {};

    // 保留未过期的
    Object.entries(alerts).forEach(([k, v]) => {
      if (now - v.ts < ALERT_TTL) {
        cleanAlerts[k] = v;
      }
    });

    // 添加新记录
    cleanAlerts[stationKey] = { sig, ts: now };
    
    return { alerts: cleanAlerts };
  });
}

/**
 * 全局清理：移除所有过期数据
 */
export function cleanupWeatherCache() {
  const now = Date.now();
  saveWeatherCache((current) => {
    const updates: Partial<WeatherCache> = {};
    let changed = false;

    // 清理坐标
    if (current.coords && now - current.coords.updatedAt > COORDS_TTL) {
      updates.coords = undefined;
      changed = true;
    }

    // 清理位置
    if (current.location && now - current.location.updatedAt > LOCATION_TTL) {
      updates.location = undefined;
      changed = true;
    }

    // 清理分钟级降水
    if (current.minutely && now - current.minutely.updatedAt > MINUTELY_TTL) {
      updates.minutely = undefined;
      changed = true;
    }

    // 清理预警 (在 writeStationAlertRecord 中已有部分清理，这里做彻底检查)
    if (current.alerts) {
      const cleanAlerts: Record<string, { sig: string; ts: number }> = {};
      let alertCount = 0;
      let alertChanged = false;

      Object.entries(current.alerts).forEach(([k, v]) => {
        if (now - v.ts < ALERT_TTL) {
          cleanAlerts[k] = v;
          alertCount++;
        } else {
          alertChanged = true;
        }
      });

      if (alertChanged) {
        updates.alerts = alertCount > 0 ? cleanAlerts : undefined;
        changed = true;
      }
    }

    return changed ? updates : {};
  });
}

/**
 * 清除所有天气缓存（用于手动刷新定位）
 */
export function clearWeatherCache() {
  localStorage.removeItem(STORAGE_KEY);
}
