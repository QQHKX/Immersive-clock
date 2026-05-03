import { httpGetJson } from "./httpClient";
import { requireEnv } from "./serviceEnv";

interface QWeatherCredential {
  host: string;
  apiKey: string;
}

let cachedCredentials: QWeatherCredential[] | null = null;
let credentialIndex = 0;

/**
 * 解析多个和风 API 凭证（host 与 key 按位置一一配对，若数量不等则最后一值重复使用）
 */
function parseCredentials(): QWeatherCredential[] {
  if (cachedCredentials) return cachedCredentials;

  const hostRaw =
    import.meta.env.VITE_QWEATHER_API_HOST || import.meta.env.VITE_QWEATHER_HOST || "";
  const keyRaw = import.meta.env.VITE_QWEATHER_API_KEY || "";

  const hosts = hostRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const keys = keyRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (hosts.length === 0 || keys.length === 0) {
    return [];
  }

  const credentials: QWeatherCredential[] = [];
  const maxLen = Math.max(hosts.length, keys.length);
  for (let i = 0; i < maxLen; i++) {
    const host = hosts[Math.min(i, hosts.length - 1)];
    const apiKey = keys[Math.min(i, keys.length - 1)];
    if (host && apiKey) {
      const key = `${host}::${apiKey}`;
      if (!credentials.some((c) => `${c.host}::${c.apiKey}` === key)) {
        credentials.push({ host, apiKey });
      }
    }
  }

  cachedCredentials = credentials;
  return credentials;
}

/**
 * 获取当前轮次的凭证（单次请求内 host 与 apiKey 保持一致）
 */
function getCurrentCredential(): QWeatherCredential {
  const creds = parseCredentials();
  if (creds.length === 0) {
    requireEnv("VITE_QWEATHER_API_HOST 或 VITE_QWEATHER_HOST", "");
    requireEnv("VITE_QWEATHER_API_KEY", "");
    return { host: "", apiKey: "" };
  }
  return creds[credentialIndex % creds.length];
}

/**
 * 轮转到下一个凭证
 */
function rotateCredential(): void {
  const creds = parseCredentials();
  if (creds.length > 0) {
    credentialIndex = (credentialIndex + 1) % creds.length;
  }
}

/**
 * 获取 QWeather API Host
 * 优先使用 VITE_QWEATHER_API_HOST
 */
export function getQWeatherHost(): string {
  return getCurrentCredential().host;
}

/**
 * 构建 QWeather 请求头（函数级中文注释）：
 * - 默认使用 X-QW-Api-Key
 * - 若配置了 VITE_QWEATHER_JWT，则额外带 Authorization Bearer
 */
export function buildQWeatherHeaders(): Record<string, string> {
  const cred = getCurrentCredential();

  const headers: Record<string, string> = {
    "X-QW-Api-Key": cred.apiKey,
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
 * 请求 QWeather JSON 数据
 * 自动拼接 Host 并附加认证请求头
 * 每次调用后轮换至下一组凭证
 */
export async function qweatherGetJson(pathWithQuery: string, timeoutMs = 10000): Promise<unknown> {
  const url = `https://${getQWeatherHost()}${pathWithQuery}`;
  const result = httpGetJson(url, buildQWeatherHeaders(), timeoutMs, {
    apiClass: "qweather",
    requestKey: `qweather:${pathWithQuery}`,
  });
  rotateCredential();
  return result;
}
