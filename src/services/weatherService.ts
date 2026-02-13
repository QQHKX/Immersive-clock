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

export type WeatherFlowOptions = LocationFlowOptions;

/**
 * 获取实时天气（函数级中文注释）。
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
 * 获取三日天气预报（函数级中文注释）。
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
 * 获取日出日落（函数级中文注释）。
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
 * 获取空气质量（函数级中文注释）：使用和风私有域 current。
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
 * 获取指定坐标的天气预警（函数级中文注释）：使用和风私有域。
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
 * 获取分钟级降水（函数级中文注释）：location 为 \"lon,lat\"，使用和风私有域。
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

function formatDateYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * 构建天气数据获取流程（函数级中文注释）：
 * - 先通过位置服务获取 coords/address/city（并写入缓存）
 * - 再并发请求 now/3d/sun/airquality
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
  const results = await Promise.allSettled([
    fetchWeatherNow(locationParam),
    fetchWeatherDaily3d(locationParam),
    fetchAstronomySun(locationParam, date),
    fetchAirQualityCurrent(loc.coords.lat, loc.coords.lon),
  ]);

  const weather =
    results[0].status === "fulfilled"
      ? results[0].value
      : ({ error: String(results[0].reason) } as WeatherNow);
  const daily3d =
    results[1].status === "fulfilled"
      ? results[1].value
      : ({ error: String(results[1].reason) } as WeatherDaily3dResponse);
  const astronomySun =
    results[2].status === "fulfilled"
      ? results[2].value
      : ({ error: String(results[2].reason) } as AstronomySunResponse);
  const airQuality =
    results[3].status === "fulfilled"
      ? results[3].value
      : ({ error: String(results[3].reason) } as AirQualityCurrentResponse);

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
