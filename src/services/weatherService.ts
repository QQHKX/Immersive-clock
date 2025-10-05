// QWeather & Amap integration service following hf.py structure
// - IP-based geolocation
// - Amap reverse geocoding, fallback to OSM
// - QWeather GeoAPI city lookup to get Location ID
// - QWeather Weather Now via private host with API KEY header

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

// 优先读取 .env 中的 VITE_QWEATHER_API_HOST，与 hf.py 保持一致
const QWEATHER_HOST = ((import.meta as any).env?.VITE_QWEATHER_API_HOST)
  || ((import.meta as any).env?.VITE_QWEATHER_HOST)
  || 'nn3yfpy58r.re.qweatherapi.com';
const QWEATHER_API_KEY = ((import.meta as any).env?.VITE_QWEATHER_API_KEY) || '822d74f851d148efab9ac68a4a74cbd8';
const AMAP_KEY = import.meta.env.VITE_AMAP_API_KEY || '4c6e2a1b83759e3be34dfbeecd9933a2';

async function httpGetJson(url: string, headers?: Record<string, string>, timeoutMs = 10000): Promise<any> {
  // Browser fetch automatically handles gzip/deflate; we still attempt robust decoding
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: headers || {},
      signal: controller.signal,
      // credentials not needed; all APIs are public
    });
    // Try JSON first
    const text = await resp.text();
    try {
      return JSON.parse(text);
    } catch {
      // Fallback: attempt different decodings if needed (UTF-8 should suffice in browser)
      return JSON.parse(text);
    }
  } finally {
    clearTimeout(timeout);
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
      // try next
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
  city?: string | null;
  locationId?: string | null;
  addressInfo?: AddressInfo | null;
  weather?: WeatherNow | null;
}> {
  const coords = await getCoordsViaIP();
  if (!coords) {
    return { coords: null };
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
  return { coords, city, locationId, addressInfo: addrInfo, weather };
}