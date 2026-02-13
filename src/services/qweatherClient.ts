import { httpGetJson } from "./httpClient";
import { requireEnv } from "./serviceEnv";

let cachedHost: string | null = null;
let cachedApiKey: string | null = null;

/**
 * 获取 QWeather API Host（函数级中文注释）：
 * - 支持两种命名：优先 VITE_QWEATHER_API_HOST，其次 VITE_QWEATHER_HOST
 */
export function getQWeatherHost(): string {
  if (cachedHost) return cachedHost;
  const host = import.meta.env.VITE_QWEATHER_API_HOST || import.meta.env.VITE_QWEATHER_HOST;
  cachedHost = requireEnv("VITE_QWEATHER_API_HOST 或 VITE_QWEATHER_HOST", host);
  return cachedHost;
}

/**
 * 构建 QWeather 请求头（函数级中文注释）：
 * - 默认使用 X-QW-Api-Key
 * - 若配置了 VITE_QWEATHER_JWT，则额外带 Authorization Bearer
 */
export function buildQWeatherHeaders(): Record<string, string> {
  if (!cachedApiKey) {
    cachedApiKey = requireEnv("VITE_QWEATHER_API_KEY", import.meta.env.VITE_QWEATHER_API_KEY);
  }

  const headers: Record<string, string> = {
    "X-QW-Api-Key": cachedApiKey,
    "Accept-Encoding": "gzip, deflate",
    "User-Agent": "QWeatherTest/1.0",
  };
  const jwt = import.meta.env.VITE_QWEATHER_JWT;
  if (jwt) {
    headers["Authorization"] = `Bearer ${jwt}`;
  }
  return headers;
}

/**
 * 请求 QWeather JSON（函数级中文注释）：
 * - 自动拼接 host 并带上标准 headers
 */
export async function qweatherGetJson(pathWithQuery: string, timeoutMs = 10000): Promise<unknown> {
  const url = `https://${getQWeatherHost()}${pathWithQuery}`;
  return httpGetJson(url, buildQWeatherHeaders(), timeoutMs);
}
