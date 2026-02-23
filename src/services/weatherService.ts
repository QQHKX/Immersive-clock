import type {
  AddressInfo,
  AirQualityCurrentResponse,
  AstronomySunResponse,
  CityLookupResponse,
  Coords,
  GeolocationDiagnostics,
  GeolocationPermissionState,
  GeolocationResult,
  MinutelyPrecipResponse,
  WeatherHourly72hResponse,
  WeatherAlertResponse,
  WeatherDaily3dResponse,
  WeatherNow,
} from "../types/weather";

import { buildLocationFlow, type LocationFlowOptions } from "./locationService";
import { qweatherGetJson } from "./qweatherClient";

export type {
  AddressInfo,
  AirQualityCurrentResponse,
  AstronomySunResponse,
  CityLookupResponse,
  Coords,
  GeolocationDiagnostics,
  GeolocationPermissionState,
  GeolocationResult,
  MinutelyPrecipResponse,
  LocationFlowOptions,
  WeatherHourly72hResponse,
  WeatherAlertResponse,
  WeatherDaily3dResponse,
  WeatherNow,
};

export {
  buildLocationFlow,
  fetchCityLookup,
  getCoordsViaAmapIP,
  getCoordsViaGeolocation,
  getCoordsViaIP,
  getGeolocationResult,
  reverseGeocodeAmap,
  reverseGeocodeOSM,
} from "./locationService";

export interface WeatherFlowOptions extends LocationFlowOptions {
  // 功能开关：控制是否请求对应的API
  fetchDaily3d?: boolean; // 是否请求三日预报
  fetchAstronomySun?: boolean; // 是否请求日出日落
  fetchAirQuality?: boolean; // 是否请求空气质量
}

/**
 * 获取实时天气
 */
export async function fetchWeatherNow(location: string): Promise<WeatherNow> {
  try {
    const data = await qweatherGetJson(`/v7/weather/now?location=${encodeURIComponent(location)}`);
    return data as WeatherNow;
  } catch (e: unknown) {
    return { error: String(e) } as WeatherNow;
  }
}

/**
 * 获取三日天气预报
 */
export async function fetchWeatherDaily3d(location: string): Promise<WeatherDaily3dResponse> {
  try {
    const data = await qweatherGetJson(
      `/v7/weather/3d?location=${encodeURIComponent(location)}&lang=zh`
    );
    return data as WeatherDaily3dResponse;
  } catch (e: unknown) {
    return { error: String(e) } as WeatherDaily3dResponse;
  }
}

/**
 * 获取日出日落时间
 */
export async function fetchAstronomySun(
  location: string,
  date: string
): Promise<AstronomySunResponse> {
  try {
    const data = await qweatherGetJson(
      `/v7/astronomy/sun?location=${encodeURIComponent(location)}&date=${encodeURIComponent(date)}&lang=zh`
    );
    return data as AstronomySunResponse;
  } catch (e: unknown) {
    return { error: String(e) } as AstronomySunResponse;
  }
}

/**
 * 获取空气质量：使用和风私有域 current
 */
export async function fetchAirQualityCurrent(
  lat: number,
  lon: number
): Promise<AirQualityCurrentResponse> {
  try {
    const data = await qweatherGetJson(
      `/airquality/v1/current/${lat.toFixed(2)}/${lon.toFixed(2)}?lang=zh`
    );
    return data as AirQualityCurrentResponse;
  } catch (e: unknown) {
    return { error: String(e) } as AirQualityCurrentResponse;
  }
}

/**
 * 获取指定坐标的天气预警：使用和风私有域
 */
export async function fetchWeatherAlertsByCoords(
  lat: number,
  lon: number
): Promise<WeatherAlertResponse> {
  try {
    const data = await qweatherGetJson(
      `/weatheralert/v1/current/${lat.toFixed(2)}/${lon.toFixed(2)}?localTime=true&lang=zh`
    );
    return data as WeatherAlertResponse;
  } catch (e: unknown) {
    return { error: String(e) } as WeatherAlertResponse;
  }
}

/**
 * 获取分钟级降水：使用和风私有域
 */
export async function fetchMinutelyPrecip(location: string): Promise<MinutelyPrecipResponse> {
  try {
    const data = (await qweatherGetJson(
      `/v7/minutely/5m?location=${encodeURIComponent(location)}&lang=zh`
    )) as MinutelyPrecipResponse;
    return data;
  } catch (e: unknown) {
    return { error: String(e) } as MinutelyPrecipResponse;
  }
}

export async function fetchWeatherHourly72h(location: string): Promise<WeatherHourly72hResponse> {
  try {
    const data = (await qweatherGetJson(
      `/v7/weather/72h?location=${encodeURIComponent(location)}&lang=zh`
    )) as WeatherHourly72hResponse;
    return data;
  } catch (e: unknown) {
    return { error: String(e) } as WeatherHourly72hResponse;
  }
}

/**
 * 格式化日期为 YYYYMMDD
 */
function formatDateYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * 构建天气数据获取流程
 * 包含坐标获取、实时天气、预报、天文及空气质量
 * 根据功能开关按需请求对应的API
 */
export async function buildWeatherFlow(options?: WeatherFlowOptions): Promise<{
  coords: Coords | null;
  coordsSource?: string | null;
  city?: string | null;
  addressInfo?: AddressInfo | null;
  weather?: WeatherNow | null;
  daily3d?: WeatherDaily3dResponse | null;
  airQuality?: AirQualityCurrentResponse | null;
  astronomySun?: AstronomySunResponse | null;
}> {
  const loc = await buildLocationFlow(options);
  if (!loc.coords) {
    return { coords: null, coordsSource: null };
  }

  const locationParam = `${loc.coords.lon},${loc.coords.lat}`;
  const date = formatDateYYYYMMDD(new Date());

  // 构建请求列表：根据功能开关决定是否请求
  const requests: Array<Promise<unknown>> = [
    fetchWeatherNow(locationParam), // 实时天气始终请求
  ];

  if (options?.fetchDaily3d !== false) {
    requests.push(fetchWeatherDaily3d(locationParam));
  }

  if (options?.fetchAstronomySun !== false) {
    requests.push(fetchAstronomySun(locationParam, date));
  }

  if (options?.fetchAirQuality !== false) {
    requests.push(fetchAirQualityCurrent(loc.coords.lat, loc.coords.lon));
  }

  const results = await Promise.allSettled(requests);

  // 解析结果（保持原有逻辑，但需要处理可能缺失的结果）
  let weather: WeatherNow;
  const weatherResult = results[0];
  if (weatherResult.status === "fulfilled") {
    weather = weatherResult.value as WeatherNow;
  } else {
    weather = { error: String(weatherResult.reason) } as WeatherNow;
  }

  let daily3d: WeatherDaily3dResponse | null = null;
  let astronomySun: AstronomySunResponse | null = null;
  let airQuality: AirQualityCurrentResponse | null = null;

  let resultIndex = 1;

  if (options?.fetchDaily3d !== false) {
    const result = results[resultIndex];
    if (result.status === "fulfilled") {
      daily3d = result.value as WeatherDaily3dResponse;
    } else {
      daily3d = { error: String(result.reason) } as WeatherDaily3dResponse;
    }
    resultIndex++;
  }

  if (options?.fetchAstronomySun !== false) {
    const result = results[resultIndex];
    if (result.status === "fulfilled") {
      astronomySun = result.value as AstronomySunResponse;
    } else {
      astronomySun = { error: String(result.reason) } as AstronomySunResponse;
    }
    resultIndex++;
  }

  if (options?.fetchAirQuality !== false) {
    const result = results[resultIndex];
    if (result.status === "fulfilled") {
      airQuality = result.value as AirQualityCurrentResponse;
    } else {
      airQuality = { error: String(result.reason) } as AirQualityCurrentResponse;
    }
  }

  return {
    coords: loc.coords,
    coordsSource: loc.coordsSource,
    city: loc.city,
    addressInfo: loc.addressInfo,
    weather,
    daily3d,
    astronomySun,
    airQuality,
  };
}
