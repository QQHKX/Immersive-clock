// 天气服务整合（和风天气 + 高德地图）
// - 基于 IP 的地理定位
// - 高德地图反向地理编码，失败时回退到 OSM
// - 使用和风 GeoAPI 城市查询以获取 Location ID
// - 通过和风私有域（携带 API KEY 头）获取实时天气

import {
  getValidCoords,
  updateCoordsCache,
  getValidLocation,
  updateLocationCache,
  updateGeolocationDiagnostics,
} from "../utils/weatherStorage";

export interface Coords {
  lat: number;
  lon: number;
}

export type GeolocationPermissionState = "granted" | "denied" | "prompt" | "unsupported" | "unknown";

export interface GeolocationDiagnostics {
  isSupported: boolean;
  isSecureContext: boolean;
  permissionState: GeolocationPermissionState;
  usedHighAccuracy: boolean;
  timeoutMs: number;
  maximumAgeMs: number;
  attemptedAt: number;
  errorCode?: number;
  errorMessage?: string;
}

export interface GeolocationResult {
  coords: Coords | null;
  diagnostics: GeolocationDiagnostics;
}

export interface WeatherNow {
  code?: string;
  now?: {
    obsTime?: string;
    text?: string;
    temp?: string;
    feelsLike?: string;
    windDir?: string;
    windScale?: string;
    windSpeed?: string;
    humidity?: string;
    pressure?: string;
    precip?: string;
    vis?: string;
    cloud?: string;
    dew?: string;
    icon?: string;
  };
  refer?: {
    sources?: string[];
    license?: string[];
  };
  error?: string;
}

export interface AddressInfo {
  address?: string;
  source?: string;
  raw?: unknown;
  error?: string;
}

// 第三方响应类型声明
interface AmapIpResponse {
  status?: string;
  info?: string;
  rectangle?: string;
}

interface IpInfoResponse {
  loc?: string;
}

interface OsmAddress {
  road?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
}

interface OsmReverseResponse {
  address?: OsmAddress;
  display_name?: string;
}

interface AmapReverseResponse {
  status?: string;
  info?: string;
  regeocode?: {
    formatted_address?: string;
    addressComponent?: {
      streetNumber?: { street?: string; number?: string };
      township?: string;
      district?: string;
      city?: string;
      province?: string;
    };
  };
}

// 只使用环境变量，不再包含任何硬编码默认值
function requireEnv(name: string, value: string | undefined): string {
  if (!value || !String(value).trim()) {
    throw new Error(`环境变量缺失：${name}`);
  }
  return String(value).trim();
}

// 支持两种命名：优先 VITE_QWEATHER_API_HOST，其次 VITE_QWEATHER_HOST
const QWEATHER_HOST = (() => {
  const host = import.meta.env.VITE_QWEATHER_API_HOST || import.meta.env.VITE_QWEATHER_HOST;
  return requireEnv("VITE_QWEATHER_API_HOST 或 VITE_QWEATHER_HOST", host);
})();

const QWEATHER_API_KEY = requireEnv("VITE_QWEATHER_API_KEY", import.meta.env.VITE_QWEATHER_API_KEY);
const AMAP_KEY = requireEnv("VITE_AMAP_API_KEY", import.meta.env.VITE_AMAP_API_KEY);

async function httpGetJson(
  url: string,
  headers?: Record<string, string>,
  timeoutMs = 10000
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: headers || {},
      signal: controller.signal,
      // 无需携带凭据：当前接口均为公开访问
    });
    const text = await resp.text();
    const preview = String(text || "")
      .replace(/\s+/g, " ")
      .slice(0, 300);

    let parsed: unknown | null = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = null;
      }
    }

    if (!resp.ok) {
      throw new Error(
        `HTTP ${resp.status} ${resp.statusText}：${url}${preview ? `｜${preview}` : ""}`
      );
    }

    if (parsed == null) {
      throw new Error(`响应非 JSON：${url}${preview ? `｜${preview}` : ""}`);
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 获取浏览器 geolocation 权限状态（尽可能不抛错）
 */
async function getGeolocationPermissionState(): Promise<GeolocationPermissionState> {
  try {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) {
      return "unsupported";
    }
    const perms = navigator.permissions as unknown as {
      query: (d: { name: string }) => Promise<{ state?: string }>;
    };
    const status = await perms.query({ name: "geolocation" });
    const state = String(status?.state || "").toLowerCase();
    if (state === "granted" || state === "denied" || state === "prompt") return state;
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * 通过浏览器原生 Geolocation API 获取坐标与诊断信息
 */
export async function getGeolocationResult(options?: {
  timeoutMs?: number;
  maximumAgeMs?: number;
  enableHighAccuracy?: boolean;
}): Promise<GeolocationResult> {
  const attemptedAt = Date.now();
  const isSupported = typeof navigator !== "undefined" && "geolocation" in navigator;
  const isSecureContext = typeof window !== "undefined" ? Boolean(window.isSecureContext) : false;
  const permissionState = await getGeolocationPermissionState();

  const timeoutMs = options?.timeoutMs ?? 25000;
  const maximumAgeMs = options?.maximumAgeMs ?? 60 * 1000;
  const enableHighAccuracy = options?.enableHighAccuracy ?? true;

  const baseDiagnostics: GeolocationDiagnostics = {
    isSupported,
    isSecureContext,
    permissionState,
    usedHighAccuracy: enableHighAccuracy,
    timeoutMs,
    maximumAgeMs,
    attemptedAt,
  };

  if (!isSupported || !isSecureContext) {
    return { coords: null, diagnostics: baseDiagnostics };
  }

  const runOnce = (cfg: {
    enableHighAccuracy: boolean;
    timeout: number;
    maximumAge: number;
  }): Promise<{ coords: Coords | null; error?: GeolocationPositionError }> => {
    return new Promise((resolve) => {
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos?.coords?.latitude;
            const lon = pos?.coords?.longitude;
            if (typeof lat === "number" && typeof lon === "number") {
              resolve({ coords: { lat, lon } });
            } else {
              resolve({ coords: null });
            }
          },
          (err) => resolve({ coords: null, error: err }),
          cfg
        );
      } catch {
        resolve({ coords: null });
      }
    });
  };

  const first = await runOnce({
    enableHighAccuracy,
    timeout: timeoutMs,
    maximumAge: maximumAgeMs,
  });

  if (first.coords) {
    return { coords: first.coords, diagnostics: baseDiagnostics };
  }

  const firstErrCode = first.error?.code;
  const firstErrMessage = first.error?.message;

  if (firstErrCode === 1) {
    return {
      coords: null,
      diagnostics: { ...baseDiagnostics, errorCode: firstErrCode, errorMessage: firstErrMessage },
    };
  }

  if (enableHighAccuracy) {
    const second = await runOnce({
      enableHighAccuracy: false,
      timeout: Math.min(12000, timeoutMs),
      maximumAge: maximumAgeMs,
    });
    if (second.coords) {
      return {
        coords: second.coords,
        diagnostics: { ...baseDiagnostics, usedHighAccuracy: false },
      };
    }
    return {
      coords: null,
      diagnostics: {
        ...baseDiagnostics,
        usedHighAccuracy: false,
        errorCode: second.error?.code ?? firstErrCode,
        errorMessage: second.error?.message ?? firstErrMessage,
      },
    };
  }

  return {
    coords: null,
    diagnostics: { ...baseDiagnostics, errorCode: firstErrCode, errorMessage: firstErrMessage },
  };
}

/**
 * 通过浏览器原生 Geolocation API 获取坐标
 * 优先策略：高精度、合理超时；失败（含拒绝授权）返回 null
 */
export async function getCoordsViaGeolocation(): Promise<Coords | null> {
  const result = await getGeolocationResult();
  return result.coords;
}

/**
 * 使用高德地图的 IP 定位获取坐标（通过返回的城市矩形取中心点）
 * 若失败返回 null
 */
export async function getCoordsViaAmapIP(): Promise<Coords | null> {
  const url = `https://restapi.amap.com/v3/ip?key=${encodeURIComponent(AMAP_KEY)}`;
  try {
    const data = (await httpGetJson(url, {
      "User-Agent": "QWeatherTest/1.0",
      "Accept-Encoding": "gzip, deflate",
    })) as AmapIpResponse;
    if (String(data?.status) !== "1") {
      return null;
    }
    const rect: string | undefined = data?.rectangle;
    // rectangle 形如："lon1,lat1;lon2,lat2"
    if (rect && rect.includes(";")) {
      const [p1, p2] = rect.split(";");
      const [lon1Str, lat1Str] = p1.split(",");
      const [lon2Str, lat2Str] = p2.split(",");
      const lon1 = parseFloat(lon1Str);
      const lat1 = parseFloat(lat1Str);
      const lon2 = parseFloat(lon2Str);
      const lat2 = parseFloat(lat2Str);
      if ([lon1, lat1, lon2, lat2].every((v) => Number.isFinite(v))) {
        const lon = (lon1 + lon2) / 2;
        const lat = (lat1 + lat2) / 2;
        return { lat, lon };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function getCoordsViaIP(): Promise<Coords | null> {
  const sources: Array<[string, string[]]> = [
    ["https://ipapi.co/json/", ["latitude", "longitude"]],
    ["https://ipinfo.io/json", ["loc"]],
  ];
  for (const [url, keys] of sources) {
    try {
      const data = (await httpGetJson(url, { "User-Agent": "QWeatherTest/1.0" })) as Record<
        string,
        unknown
      >;
      if (keys.length === 1 && keys[0] === "loc") {
        const loc = (data as IpInfoResponse)?.loc;
        if (loc && loc.includes(",")) {
          const [latStr, lonStr] = loc.split(",", 2);
          return { lat: parseFloat(latStr), lon: parseFloat(lonStr) };
        }
      } else {
        const latRaw = data[keys[0]];
        const lonRaw = data[keys[1]];
        const latNum =
          typeof latRaw === "number"
            ? latRaw
            : typeof latRaw === "string"
              ? parseFloat(latRaw)
              : NaN;
        const lonNum =
          typeof lonRaw === "number"
            ? lonRaw
            : typeof lonRaw === "string"
              ? parseFloat(lonRaw)
              : NaN;
        if (Number.isFinite(latNum) && Number.isFinite(lonNum)) {
          return { lat: latNum, lon: lonNum };
        }
      }
    } catch {
      // 继续尝试下一个数据源
    }
  }
  return null;
}

export async function fetchWeatherNow(location: string): Promise<WeatherNow> {
  const url = `https://${QWEATHER_HOST}/v7/weather/now?location=${encodeURIComponent(location)}`;
  try {
    const headers: Record<string, string> = {
      "X-QW-Api-Key": QWEATHER_API_KEY,
      "Accept-Encoding": "gzip, deflate",
      "User-Agent": "QWeatherTest/1.0",
    };
    const jwt = import.meta.env.VITE_QWEATHER_JWT;
    if (jwt) {
      headers["Authorization"] = `Bearer ${jwt}`;
    }
    const data = await httpGetJson(url, headers);
    return data as WeatherNow;
  } catch (e: unknown) {
    return { error: String(e) } as WeatherNow;
  }
}

// 天气预警类型
export interface WeatherAlertResponse {
  metadata?: {
    tag?: string;
    zeroResult?: boolean;
  };
  alerts?: Array<{
    id?: string;
    senderName?: string;
    issuedTime?: string;
    eventType?: { name?: string; code?: string };
    severity?: string | null;
    color?: { code?: string };
    effectiveTime?: string;
    expireTime?: string;
    headline?: string;
    description?: string;
  }>;
  error?: string;
}

// 分钟级降水类型
export interface MinutelyPrecipResponse {
  code?: string;
  updateTime?: string;
  summary?: string;
  minutely?: Array<{ fxTime?: string; precip?: string; type?: string }>;
  error?: string;
}

/**
 * 获取指定坐标的天气预警
 * 使用和风私有域，携带 API Key 与可选 JWT
 */
export async function fetchWeatherAlertsByCoords(
  lat: number,
  lon: number
): Promise<WeatherAlertResponse> {
  const url = `https://${QWEATHER_HOST}/weatheralert/v1/current/${lat.toFixed(2)}/${lon.toFixed(2)}?localTime=true&lang=zh`;
  try {
    const headers: Record<string, string> = {
      "X-QW-Api-Key": QWEATHER_API_KEY,
      "Accept-Encoding": "gzip, deflate",
      "User-Agent": "QWeatherTest/1.0",
    };
    const jwt = import.meta.env.VITE_QWEATHER_JWT;
    if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
    const data = await httpGetJson(url, headers);
    return data as WeatherAlertResponse;
  } catch (e: unknown) {
    return { error: String(e) } as WeatherAlertResponse;
  }
}

/**
 * 获取分钟级降水（未来2小时每5分钟）
 * location 为 "lon,lat"，使用和风私有域
 * 注意：此函数仅负责 API 请求，不处理缓存。缓存由 weatherStorage 统一管理。
 */
export async function fetchMinutelyPrecip(location: string): Promise<MinutelyPrecipResponse> {
  const url = `https://${QWEATHER_HOST}/v7/minutely/5m?location=${encodeURIComponent(location)}&lang=zh`;
  try {
    const headers: Record<string, string> = {
      "X-QW-Api-Key": QWEATHER_API_KEY,
      "Accept-Encoding": "gzip, deflate",
      "User-Agent": "QWeatherTest/1.0",
    };
    const jwt = import.meta.env.VITE_QWEATHER_JWT;
    if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
    const data = (await httpGetJson(url, headers)) as MinutelyPrecipResponse;
    return data;
  } catch (e: unknown) {
    return { error: String(e) } as MinutelyPrecipResponse;
  }
}

export async function geoCityLookup(lat: number, lon: number): Promise<unknown> {
  const url = `https://${QWEATHER_HOST}/geo/v2/city/lookup?location=${encodeURIComponent(`${lon},${lat}`)}&lang=zh`;
  try {
    const headers: Record<string, string> = {
      "X-QW-Api-Key": QWEATHER_API_KEY,
      "User-Agent": "QWeatherTest/1.0",
      "Accept-Encoding": "gzip, deflate",
    };
    const jwt = import.meta.env.VITE_QWEATHER_JWT;
    if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
    return await httpGetJson(url, headers);
  } catch (e: unknown) {
    return { error: String(e) };
  }
}

export async function reverseGeocodeOSM(lat: number, lon: number): Promise<AddressInfo> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
  try {
    const data = (await httpGetJson(url, {
      "User-Agent": "QWeatherTest/1.0 (+https://dev.qweather.com/)",
      "Accept-Language": "zh-CN",
      "Accept-Encoding": "gzip, deflate",
    })) as OsmReverseResponse;
    const addr: OsmAddress = data?.address || {};
    const parts: string[] = [];
    if (addr.road) parts.push(addr.road);
    if (addr.house_number) parts.push(addr.house_number);
    if (addr.neighbourhood) parts.push(addr.neighbourhood);
    else if (addr.suburb) parts.push(addr.suburb);
    const city = addr.city || addr.town || addr.village || addr.county;
    if (city) parts.push(city);
    if (addr.state) parts.push(addr.state);
    if (addr.country) parts.push(addr.country);
    const formatted = parts.length ? parts.join(" ") : data?.display_name;
    return { address: formatted, raw: addr, source: "OSM" };
  } catch (e: unknown) {
    return { error: String(e) };
  }
}

export async function reverseGeocodeAmap(lat: number, lon: number): Promise<AddressInfo> {
  const url = `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(AMAP_KEY)}&location=${encodeURIComponent(`${lon},${lat}`)}&extensions=base&radius=1000&roadlevel=0`;
  try {
    const data = (await httpGetJson(url, {
      "User-Agent": "QWeatherTest/1.0",
      "Accept-Encoding": "gzip, deflate",
    })) as AmapReverseResponse;
    if (String(data?.status) !== "1") {
      return { error: data?.info || "Amap status!=1" };
    }
    const regeocode = data?.regeocode || {};
    const comp = (regeocode.addressComponent ?? {}) as {
      streetNumber?: { street?: string; number?: string };
      township?: string;
      district?: string;
      city?: string;
      province?: string;
    };
    const streetNum = (comp?.streetNumber || {}) as { street?: string; number?: string };
    const parts: string[] = [];
    if (streetNum.street) parts.push(streetNum.street);
    if (streetNum.number) parts.push(streetNum.number);
    if (comp.township) parts.push(comp.township);
    if (comp.district) parts.push(comp.district);
    if (comp.city) parts.push(comp.city);
    if (comp.province) parts.push(comp.province);
    const addr = parts.filter(Boolean).join(" ") || regeocode?.formatted_address;
    return { address: addr, source: "Amap", raw: data };
  } catch (e: unknown) {
    return { error: String(e) };
  }
}

/**
 * 构建天气数据获取流程（函数级注释）：
 * - 优先使用本地缓存的地理坐标与地理反编码结果（通过 weatherStorage 管理）；
 * - 缓存失效时按序执行定位：浏览器 Geolocation → 高德 IP → 其他 IP；
 * - 反编码（高德/OSM）与和风城市查询同样进行缓存，避免重复请求；
 * - 始终实时请求和风实时天气（不缓存），以保证数据新鲜。
 */
export async function buildWeatherFlow(): Promise<{
  coords: Coords | null;
  coordsSource?: string | null;
  city?: string | null;
  locationId?: string | null;
  addressInfo?: AddressInfo | null;
  weather?: WeatherNow | null;
}> {
  // 1. 读取坐标缓存
  let coords: Coords | null = null;
  let coordsSource: string | null = null;

  const cachedCoords = getValidCoords();
  if (cachedCoords) {
    coords = { lat: cachedCoords.lat, lon: cachedCoords.lon };
    coordsSource = cachedCoords.source;
  }

  // 策略调整：如果当前没有缓存，或者缓存不是来自浏览器定位，则尝试浏览器定位
  if (!coords || coordsSource !== "geolocation") {
    const geo = await getGeolocationResult();
    updateGeolocationDiagnostics(geo.diagnostics);
    if (geo.coords) {
      coords = geo.coords;
      coordsSource = "geolocation";
      // 立即更新缓存
      updateCoordsCache(coords.lat, coords.lon, coordsSource);
    }
  }

  // 如果经过上述步骤仍无坐标（既无缓存也无浏览器定位），则降级到 IP 定位
  if (!coords) {
    const a = await getCoordsViaAmapIP();
    if (a) {
      coords = a;
      coordsSource = "amap_ip";
    } else {
      const i = await getCoordsViaIP();
      if (i) {
        coords = i;
        coordsSource = "ip";
      }
    }
    // 写入坐标缓存
    if (coords && coordsSource) {
      updateCoordsCache(coords.lat, coords.lon, coordsSource);
    }
  }

  if (!coords) {
    return { coords: null, coordsSource: null };
  }

  // 2. 城市与 LocationID 缓存
  let city: string | null = null;
  let locationId: string | null = null;
  let addressInfo: AddressInfo | null = null;

  const cachedLoc = getValidLocation(coords.lat, coords.lon);

  if (cachedLoc) {
    // 命中缓存
    city = cachedLoc.city || null;
    locationId = cachedLoc.locationId || null;
    addressInfo = {
      address: cachedLoc.address,
      source: cachedLoc.addressSource,
    };
  } else {
    // 缓存失效，重新查询

    // 2.1 城市查询 (GeoAPI)
    const lookup = (await geoCityLookup(coords.lat, coords.lon)) as {
      location?: Array<{ name?: string; id?: string }>;
    };
    if (lookup && Array.isArray(lookup.location) && lookup.location.length > 0) {
      const first = lookup.location[0];
      city = first?.name || null;
      locationId = first?.id || null;
    }

    // 2.2 反向地理编码 (Amap -> OSM)
    let tmp = await reverseGeocodeAmap(coords.lat, coords.lon);
    if (!tmp.address) {
      const fb = await reverseGeocodeOSM(coords.lat, coords.lon);
      if (fb?.address) tmp = fb;
    }
    addressInfo = tmp;

    // 更新缓存
    updateLocationCache(coords.lat, coords.lon, {
      city: city || undefined,
      locationId: locationId || undefined,
      address: addressInfo.address,
      addressSource: addressInfo.source,
    });
  }

  // 3. 实时天气始终请求最新
  const locationParam = locationId || `${coords.lon},${coords.lat}`;
  const weather = await fetchWeatherNow(locationParam);
  return { coords, coordsSource, city, locationId, addressInfo, weather };
}
