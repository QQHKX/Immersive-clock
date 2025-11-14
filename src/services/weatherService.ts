// 天气服务整合（和风天气 + 高德地图）
// - 基于 IP 的地理定位
// - 高德地图反向地理编码，失败时回退到 OSM
// - 使用和风 GeoAPI 城市查询以获取 Location ID
// - 通过和风私有域（携带 API KEY 头）获取实时天气

export interface Coords {
  lat: number;
  lon: number;
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

interface IpapiCoResponse {
  latitude?: number;
  longitude?: number;
}

interface IpApiComResponse {
  lat?: number;
  lon?: number;
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
  // 浏览器 fetch 默认支持 gzip/deflate；此处仍按稳健方式处理解码
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: headers || {},
      signal: controller.signal,
      // 无需携带凭据：当前接口均为公开访问
    });
    // 优先尝试直接解析 JSON
    const text = await resp.text();
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return JSON.parse(text) as unknown;
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 通过浏览器原生 Geolocation API 获取坐标
 * 优先策略：高精度、合理超时；失败（含拒绝授权）返回 null
 */
export async function getCoordsViaGeolocation(): Promise<Coords | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return null;
  }
  return new Promise<Coords | null>((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos?.coords?.latitude;
          const lon = pos?.coords?.longitude;
          if (typeof lat === "number" && typeof lon === "number") {
            resolve({ lat, lon });
          } else {
            resolve(null);
          }
        },
        () => resolve(null),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } catch {
      resolve(null);
    }
  });
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
    ["http://ip-api.com/json/", ["lat", "lon"]],
    ["https://ipinfo.io/json", ["loc"]],
  ];
  for (const [url, keys] of sources) {
    try {
      const data = (await httpGetJson(url, { "User-Agent": "QWeatherTest/1.0" })) as Record<string, unknown>;
      if (keys.length === 1 && keys[0] === "loc") {
        const loc = (data as IpInfoResponse)?.loc;
        if (loc && loc.includes(",")) {
          const [latStr, lonStr] = loc.split(",", 2);
          return { lat: parseFloat(latStr), lon: parseFloat(lonStr) };
        }
      } else {
        const latRaw = data[keys[0]];
        const lonRaw = data[keys[1]];
        const latNum = typeof latRaw === "number" ? latRaw : typeof latRaw === "string" ? parseFloat(latRaw) : NaN;
        const lonNum = typeof lonRaw === "number" ? lonRaw : typeof lonRaw === "string" ? parseFloat(lonRaw) : NaN;
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
export async function fetchWeatherAlertsByCoords(lat: number, lon: number): Promise<WeatherAlertResponse> {
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
    const data = await httpGetJson(url, headers);
    return data as MinutelyPrecipResponse;
  } catch (e: unknown) {
    return { error: String(e) } as MinutelyPrecipResponse;
  }
}

export async function geoCityLookup(lat: number, lon: number): Promise<unknown> {
  const url = `https://geoapi.qweather.com/v2/city/lookup?location=${encodeURIComponent(`${lon},${lat}`)}&key=${encodeURIComponent(QWEATHER_API_KEY)}`;
  try {
    return await httpGetJson(url, {
      "User-Agent": "QWeatherTest/1.0",
      "Accept-Encoding": "gzip, deflate",
    });
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
 * - 优先使用本地缓存的地理坐标与地理反编码结果；缓存有效期为12小时；
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
  const MAX_AGE = 12 * 60 * 60 * 1000; // 12小时缓存
  const now = Date.now();

  // 读取坐标缓存
  let coords: Coords | null = null;
  let coordsSource: string | null = null;
  try {
    const latStr = localStorage.getItem("weather.coords.lat");
    const lonStr = localStorage.getItem("weather.coords.lon");
    const cachedAtStr = localStorage.getItem("weather.coords.cachedAt");
    const sourceStr = localStorage.getItem("weather.coords.source");
    const cachedAt = cachedAtStr ? parseInt(cachedAtStr, 10) : 0;
    if (latStr && lonStr && cachedAt > 0 && now - cachedAt < MAX_AGE) {
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        coords = { lat, lon };
        coordsSource = sourceStr || null;
      }
    }
  } catch {
    /* 忽略缓存读取错误 */
  }

  // 缓存缺失或过期时重新定位
  if (!coords) {
    // 新定位策略：优先浏览器 Geolocation，其次高德 IP，最后其他 IP 源
    const g = await getCoordsViaGeolocation();
    if (g) {
      coords = g;
      coordsSource = "geolocation";
    } else {
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
    }
    // 写入坐标缓存
    try {
      if (coords) {
        localStorage.setItem("weather.coords.lat", String(coords.lat));
        localStorage.setItem("weather.coords.lon", String(coords.lon));
        localStorage.setItem("weather.coords.cachedAt", String(now));
        if (coordsSource) localStorage.setItem("weather.coords.source", coordsSource);
      }
    } catch {
      /* 忽略写入错误 */
    }
  }

  if (!coords) {
    return { coords: null, coordsSource: null };
  }

  // 构造坐标签名，减少浮点抖动导致的误判
  const coordSig = `${coords.lat.toFixed(4)},${coords.lon.toFixed(4)}`;

  // 城市与 LocationID 缓存
  let city: string | null = null;
  let locationId: string | null = null;
  try {
    const cityCachedAtStr = localStorage.getItem("weather.city.cachedAt");
    const citySig = localStorage.getItem("weather.city.sig") || "";
    const cityCachedAt = cityCachedAtStr ? parseInt(cityCachedAtStr, 10) : 0;
    if (citySig === coordSig && cityCachedAt > 0 && now - cityCachedAt < MAX_AGE) {
      city = localStorage.getItem("weather.city");
      locationId = localStorage.getItem("weather.locationId");
    } else {
      const lookup = (await geoCityLookup(coords.lat, coords.lon)) as {
        location?: Array<{ name?: string; id?: string }>;
      };
      if (lookup && Array.isArray(lookup.location) && lookup.location.length > 0) {
        const first = lookup.location[0];
        city = first?.name || null;
        locationId = first?.id || null;
        try {
          if (city) localStorage.setItem("weather.city", city);
          if (locationId) localStorage.setItem("weather.locationId", locationId);
          localStorage.setItem("weather.city.cachedAt", String(now));
          localStorage.setItem("weather.city.sig", coordSig);
        } catch {
          /* 忽略写入错误 */
        }
      }
    }
  } catch {
    /* 忽略读取错误 */
  }

  // 反向地理编码缓存（详细地址）
  let addrInfo: AddressInfo | null = null;
  try {
    const addrCachedAtStr = localStorage.getItem("weather.address.cachedAt");
    const addrSig = localStorage.getItem("weather.address.sig") || "";
    const addrCachedAt = addrCachedAtStr ? parseInt(addrCachedAtStr, 10) : 0;
    if (addrSig === coordSig && addrCachedAt > 0 && now - addrCachedAt < MAX_AGE) {
      const address = localStorage.getItem("weather.address") || undefined;
      const source = localStorage.getItem("weather.address.source") || undefined;
      addrInfo = { address, source };
    } else {
      let tmp = await reverseGeocodeAmap(coords.lat, coords.lon);
      if (!tmp.address) {
        const fb = await reverseGeocodeOSM(coords.lat, coords.lon);
        if (fb?.address) tmp = fb;
      }
      addrInfo = tmp;
      try {
        if (tmp.address) {
          localStorage.setItem("weather.address", tmp.address);
          if (tmp.source) localStorage.setItem("weather.address.source", tmp.source);
          localStorage.setItem("weather.address.cachedAt", String(now));
          localStorage.setItem("weather.address.sig", coordSig);
        }
      } catch {
        /* 忽略写入错误 */
      }
    }
  } catch {
    /* 忽略读取错误 */
  }

  // 实时天气始终请求最新
  const locationParam = locationId || `${coords.lon},${coords.lat}`;
  const weather = await fetchWeatherNow(locationParam);
  return { coords, coordsSource, city, locationId, addressInfo: addrInfo, weather };
}
