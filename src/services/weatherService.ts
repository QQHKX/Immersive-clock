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
  raw?: any;
  error?: string;
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
  const host = ((import.meta as any).env?.VITE_QWEATHER_API_HOST) || ((import.meta as any).env?.VITE_QWEATHER_HOST);
  return requireEnv('VITE_QWEATHER_API_HOST 或 VITE_QWEATHER_HOST', host);
})();

const QWEATHER_API_KEY = requireEnv('VITE_QWEATHER_API_KEY', (import.meta as any).env?.VITE_QWEATHER_API_KEY);
const AMAP_KEY = requireEnv('VITE_AMAP_API_KEY', import.meta.env.VITE_AMAP_API_KEY);

async function httpGetJson(url: string, headers?: Record<string, string>, timeoutMs = 10000): Promise<any> {
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
      return JSON.parse(text);
    } catch {
      // 回退策略：如有需要尝试不同解码（浏览器默认 UTF-8 已足够）
      return JSON.parse(text);
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
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return null;
  }
  return new Promise<Coords | null>((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos?.coords?.latitude;
          const lon = pos?.coords?.longitude;
          if (typeof lat === 'number' && typeof lon === 'number') {
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
    const data = await httpGetJson(url, {
      'User-Agent': 'QWeatherTest/1.0',
      'Accept-Encoding': 'gzip, deflate',
    });
    if (String(data?.status) !== '1') {
      return null;
    }
    const rect: string | undefined = data?.rectangle;
    // rectangle 形如："lon1,lat1;lon2,lat2"
    if (rect && rect.includes(';')) {
      const [p1, p2] = rect.split(';');
      const [lon1Str, lat1Str] = p1.split(',');
      const [lon2Str, lat2Str] = p2.split(',');
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
    ['https://ipapi.co/json/', ['latitude', 'longitude']],
    ['http://ip-api.com/json/', ['lat', 'lon']],
    ['https://ipinfo.io/json', ['loc']],
  ];
  for (const [url, keys] of sources) {
    try {
      const data = await httpGetJson(url, { 'User-Agent': 'QWeatherTest/1.0' });
      if (keys.length === 1 && keys[0] === 'loc') {
        const loc: string | undefined = data?.loc;
        if (loc && loc.includes(',')) {
          const [latStr, lonStr] = loc.split(',', 2);
          return { lat: parseFloat(latStr), lon: parseFloat(lonStr) };
        }
      } else {
        const lat = data?.[keys[0]];
        const lon = data?.[keys[1]];
        if (lat != null && lon != null) {
          return { lat: parseFloat(lat), lon: parseFloat(lon) };
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
      'X-QW-Api-Key': QWEATHER_API_KEY,
      'Accept-Encoding': 'gzip, deflate',
      'User-Agent': 'QWeatherTest/1.0',
    };
    const jwt = (import.meta as any).env?.VITE_QWEATHER_JWT;
    if (jwt) {
      headers['Authorization'] = `Bearer ${jwt}`;
    }
    const data = await httpGetJson(url, headers);
    return data as WeatherNow;
  } catch (e: any) {
    return { error: String(e) } as WeatherNow;
  }
}

export async function geoCityLookup(lat: number, lon: number): Promise<any> {
  const url = `https://geoapi.qweather.com/v2/city/lookup?location=${encodeURIComponent(`${lon},${lat}`)}&key=${encodeURIComponent(QWEATHER_API_KEY)}`;
  try {
    return await httpGetJson(url, {
      'User-Agent': 'QWeatherTest/1.0',
      'Accept-Encoding': 'gzip, deflate',
    });
  } catch (e: any) {
    return { error: String(e) };
  }
}

export async function reverseGeocodeOSM(lat: number, lon: number): Promise<AddressInfo> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
  try {
    const data = await httpGetJson(url, {
      'User-Agent': 'QWeatherTest/1.0 (+https://dev.qweather.com/)',
      'Accept-Language': 'zh-CN',
      'Accept-Encoding': 'gzip, deflate',
    });
    const addr = data?.address || {};
    const parts: string[] = [];
    if (addr.road) parts.push(addr.road);
    if (addr.house_number) parts.push(addr.house_number);
    if (addr.neighbourhood) parts.push(addr.neighbourhood);
    else if (addr.suburb) parts.push(addr.suburb);
    const city = addr.city || addr.town || addr.village || addr.county;
    if (city) parts.push(city);
    if (addr.state) parts.push(addr.state);
    if (addr.country) parts.push(addr.country);
    const formatted = parts.length ? parts.join(' ') : data?.display_name;
    return { address: formatted, raw: addr, source: 'OSM' };
  } catch (e: any) {
    return { error: String(e) };
  }
}

export async function reverseGeocodeAmap(lat: number, lon: number): Promise<AddressInfo> {
  const url = `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(AMAP_KEY)}&location=${encodeURIComponent(`${lon},${lat}`)}&extensions=base&radius=1000&roadlevel=0`;
  try {
    const data = await httpGetJson(url, {
      'User-Agent': 'QWeatherTest/1.0',
      'Accept-Encoding': 'gzip, deflate',
    });
    if (String(data?.status) !== '1') {
      return { error: data?.info || 'Amap status!=1' };
    }
    const regeocode = data?.regeocode || {};
    const comp = regeocode?.addressComponent || {};
    const streetNum = comp?.streetNumber || {};
    const parts: string[] = [];
    if (streetNum.street) parts.push(streetNum.street);
    if (streetNum.number) parts.push(streetNum.number);
    if (comp.township) parts.push(comp.township);
    if (comp.district) parts.push(comp.district);
    if (comp.city) parts.push(comp.city);
    if (comp.province) parts.push(comp.province);
    const addr = parts.filter(Boolean).join(' ') || regeocode?.formatted_address;
    return { address: addr, source: 'Amap', raw: data };
  } catch (e: any) {
    return { error: String(e) };
  }
}

export async function buildWeatherFlow(): Promise<{
  coords: Coords | null;
  coordsSource?: string | null;
  city?: string | null;
  locationId?: string | null;
  addressInfo?: AddressInfo | null;
  weather?: WeatherNow | null;
}> {
  // 新定位策略：优先浏览器 Geolocation，其次高德 IP，最后其他 IP 源
  let coordsSource: string | null = null;
  let coords: Coords | null = await getCoordsViaGeolocation();
  if (coords) {
    coordsSource = 'geolocation';
  } else {
    coords = await getCoordsViaAmapIP();
    if (coords) {
      coordsSource = 'amap_ip';
    } else {
      coords = await getCoordsViaIP();
      if (coords) {
        coordsSource = 'ip';
      }
    }
  }
  if (!coords) {
    return { coords: null, coordsSource: null };
  }
  const cityLookup = await geoCityLookup(coords.lat, coords.lon);
  let city: string | null = null;
  let locationId: string | null = null;
  if (cityLookup && Array.isArray(cityLookup.location) && cityLookup.location.length > 0) {
    const first = cityLookup.location[0];
    city = first?.name || null;
    locationId = first?.id || null;
  }
  let addrInfo = await reverseGeocodeAmap(coords.lat, coords.lon);
  if (!addrInfo.address) {
    const fallback = await reverseGeocodeOSM(coords.lat, coords.lon);
    if (fallback?.address) addrInfo = fallback;
  }
  const locationParam = locationId || `${coords.lon},${coords.lat}`;
  const weather = await fetchWeatherNow(locationParam);
  return { coords, coordsSource, city, locationId, addressInfo: addrInfo, weather };
}