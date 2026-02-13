import { getAppSettings, updateTimeSyncSettings } from "./appSettings";
import { logger } from "./logger";

export type TimeSyncProvider = "httpDate" | "timeApi" | "ntp";

export interface TimeSyncSampleResult {
  offsetMs: number;
  rttMs: number;
  serverEpochMs: number;
  measuredAt: number;
}

export interface TimeSyncRunResult {
  offsetMs: number;
  rttMs: number;
  serverEpochMs: number;
  measuredAt: number;
  samples: TimeSyncSampleResult[];
}

/**
 * 夹取并取整数（函数级注释：将输入限制在[min,max]区间并转为整数，避免无效配置导致异常）
 */
function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

/**
 * 计算中位数（函数级注释：用于从多次采样中取稳定的偏移量，降低网络抖动影响）
 */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * 解析 HTTP Date 头（函数级注释：将响应头中的 Date 字符串转换为毫秒时间戳）
 */
function parseHttpDateToEpochMs(dateHeader: string): number {
  const raw = String(dateHeader || "").trim();
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) {
    throw new Error(`无法解析 Date 头：${raw || "(empty)"}`);
  }
  return ms;
}

/**
 * 从对象中读取数值字段（函数级注释：支持 number 或可转 number 的 string，用于兼容多种时间 API 响应）
 */
function extractNumberField(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * 解析时间 API JSON（函数级注释：支持 epochMs/epochSeconds/unixtime/datetime 等常见字段，产出毫秒时间戳）
 */
function parseTimeApiBodyToEpochMs(body: unknown): number {
  if (typeof body !== "object" || body == null) {
    throw new Error("时间 API 响应不是对象");
  }
  const obj = body as Record<string, unknown>;

  const epochMs = extractNumberField(obj, "epochMs");
  if (epochMs != null) return Math.trunc(epochMs);

  const epochSeconds = extractNumberField(obj, "epochSeconds");
  if (epochSeconds != null) return Math.trunc(epochSeconds * 1000);

  const unixtime = extractNumberField(obj, "unixtime");
  if (unixtime != null) return Math.trunc(unixtime * 1000);

  const datetimeRaw =
    (typeof obj.datetime === "string" ? obj.datetime : null) ||
    (typeof obj.utc_datetime === "string" ? obj.utc_datetime : null);
  if (datetimeRaw) {
    const ms = Date.parse(datetimeRaw);
    if (Number.isFinite(ms)) return ms;
  }

  throw new Error("时间 API 响应缺少可识别的时间字段（epochMs/epochSeconds/unixtime/datetime）");
}

/**
 * 获取 JSON 响应（函数级注释：以 no-store 请求并做错误预览，统一抛出可读错误信息）
 */
async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const resp = await fetch(url, {
    method: "GET",
    cache: "no-store",
    credentials: "omit",
    signal,
  });
  const text = await resp.text();
  const preview = String(text || "")
    .replace(/\s+/g, " ")
    .slice(0, 200);

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${resp.statusText}${preview ? `｜${preview}` : ""}`);
  }
  if (!text) {
    throw new Error("时间 API 响应为空");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`时间 API 响应非 JSON${preview ? `｜${preview}` : ""}`);
  }
}

/**
 * 执行一次偏移测量（函数级注释：根据 provider 拉取服务端时间并用 RTT/2 估计偏移量）
 */
async function measureOffsetOnce(options: {
  provider: TimeSyncProvider;
  url: string;
  port?: number;
  timeoutMs: number;
}): Promise<TimeSyncSampleResult> {
  if (options.provider === "ntp") {
    const anyWindow = window as unknown as {
      electronAPI?: {
        timeSync?: {
          ntp?: (req: {
            host: string;
            port?: number;
            timeoutMs?: number;
          }) => Promise<TimeSyncSampleResult>;
        };
      };
    };
    const ntp = anyWindow.electronAPI?.timeSync?.ntp;
    if (typeof ntp !== "function") {
      throw new Error("NTP 校时仅桌面端可用");
    }
    const host = String(options.url || "").trim();
    if (!host) throw new Error("请先配置 NTP Host");
    return await ntp({ host, port: options.port, timeoutMs: options.timeoutMs });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const t0 = Date.now();

    if (options.provider === "httpDate") {
      const resp = await fetch(options.url, {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      });
      const dateHeader = resp.headers.get("Date");
      const t1 = Date.now();
      const rttMs = Math.max(0, t1 - t0);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      }
      if (!dateHeader) {
        throw new Error("响应缺少 Date 头（跨域请求需服务端 Expose-Headers: Date）");
      }
      const serverEpochMs = parseHttpDateToEpochMs(dateHeader);
      const estimatedClientMid = (t0 + t1) / 2;
      const offsetMs = Math.round(serverEpochMs - estimatedClientMid);
      return { offsetMs, rttMs, serverEpochMs, measuredAt: t1 };
    }

    const body = await fetchJson(options.url, controller.signal);
    const t1 = Date.now();
    const rttMs = Math.max(0, t1 - t0);
    const serverEpochMs = parseTimeApiBodyToEpochMs(body);
    const estimatedClientMid = (t0 + t1) / 2;
    const offsetMs = Math.round(serverEpochMs - estimatedClientMid);
    return { offsetMs, rttMs, serverEpochMs, measuredAt: t1 };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 读取当前 timeSync 设置（函数级注释：从本地 AppSettings 读取并保证返回结构完整）
 */
export function getTimeSyncSettings() {
  return getAppSettings().general.timeSync;
}

/**
 * 获取当前“有效偏移量”（函数级注释：网络 offset 与手动偏移相加，用于计算校时后的当前时间）
 */
export function getEffectiveOffsetMs(settings = getTimeSyncSettings()): number {
  if (!settings.enabled) return 0;
  const net = Number.isFinite(settings.offsetMs) ? settings.offsetMs : 0;
  const manual = Number.isFinite(settings.manualOffsetMs) ? settings.manualOffsetMs : 0;
  return Math.trunc(net + manual);
}

/**
 * 获取校时后的当前时间戳（函数级注释：返回 Date.now()+有效偏移量，供全局时间显示与判断统一使用）
 */
export function getAdjustedNowMs(settings = getTimeSyncSettings()): number {
  return Date.now() + getEffectiveOffsetMs(settings);
}

/**
 * 获取校时后的 Date 对象（函数级注释：将校时后的毫秒时间戳封装为 Date，替代直接 new Date()）
 */
export function getAdjustedDate(settings = getTimeSyncSettings()): Date {
  return new Date(getAdjustedNowMs(settings));
}

/**
 * 执行一次网络校时（函数级注释：按设置进行多次采样并计算稳定 offset，返回校时结果但不写入存储）
 */
export async function syncTime(options?: {
  provider?: TimeSyncProvider;
  url?: string;
  port?: number;
  samples?: number;
  timeoutMs?: number;
}): Promise<TimeSyncRunResult> {
  const settings = getTimeSyncSettings();
  const provider = options?.provider ?? settings.provider;
  const url =
    (options?.url ?? "").trim() ||
    (provider === "httpDate"
      ? settings.httpDateUrl
      : provider === "timeApi"
        ? settings.timeApiUrl
        : settings.ntpHost
    ).trim();
  if (!url) {
    throw new Error("请先配置校时 URL");
  }

  const samples = clampInt(options?.samples ?? 3, 1, 9);
  const timeoutMs = clampInt(options?.timeoutMs ?? 8000, 1000, 30000);
  const port = provider === "ntp" ? (options?.port ?? settings.ntpPort) : undefined;

  const results: TimeSyncSampleResult[] = [];
  for (let i = 0; i < samples; i++) {
    results.push(await measureOffsetOnce({ provider, url, port, timeoutMs }));
  }

  const sortedByRtt = [...results].sort((a, b) => a.rttMs - b.rttMs);
  const pickCount = Math.min(3, sortedByRtt.length);
  const picked = sortedByRtt.slice(0, pickCount);
  const offsetMs = median(picked.map((x) => x.offsetMs));
  const best = picked[0];
  return {
    offsetMs,
    rttMs: best.rttMs,
    serverEpochMs: best.serverEpochMs,
    measuredAt: best.measuredAt,
    samples: results,
  };
}

let managerStop: (() => void) | null = null;

/**
 * 启动网络校时管理器（函数级注释：负责监听事件、按间隔自动校时，并把结果写回 AppSettings）
 */
export function startTimeSyncManager(): () => void {
  if (managerStop) return managerStop;

  let timer: number | null = null;
  let isSyncing = false;
  let stopped = false;

  const clearTimer = () => {
    if (timer != null) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  const schedule = () => {
    clearTimer();
    const s = getTimeSyncSettings();
    if (!s.enabled || !s.autoSyncEnabled) return;
    const intervalMs = clampInt(s.autoSyncIntervalSec, 10, 7 * 24 * 3600) * 1000;
    timer = window.setInterval(() => {
      void syncAndPersist("auto");
    }, intervalMs);
  };

  const syncAndPersist = async (reason: "auto" | "manual" | "settings") => {
    if (stopped || isSyncing) return;
    const s = getTimeSyncSettings();
    if (!s.enabled) return;
    const url = (
      s.provider === "httpDate"
        ? s.httpDateUrl
        : s.provider === "timeApi"
          ? s.timeApiUrl
          : s.ntpHost
    ).trim();
    if (!url) return;

    isSyncing = true;
    try {
      const r = await syncTime({
        provider: s.provider,
        url,
        port: s.provider === "ntp" ? s.ntpPort : undefined,
      });
      updateTimeSyncSettings({
        offsetMs: r.offsetMs,
        lastSyncAt: Date.now(),
        lastRttMs: r.rttMs,
        lastError: "",
      });
      window.dispatchEvent(new CustomEvent("timeSync:updated"));
      logger.info(`网络校时成功 (${reason}): 偏移量=${r.offsetMs}ms 延迟=${r.rttMs}ms`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      updateTimeSyncSettings({
        lastSyncAt: Date.now(),
        lastError: msg,
      });
      window.dispatchEvent(new CustomEvent("timeSync:updated"));
      logger.warn(`网络校时失败 (${reason}): ${msg}`);
    } finally {
      isSyncing = false;
    }
  };

  const onSyncNow = () => {
    void syncAndPersist("manual");
  };

  const onSettingsSaved = () => {
    schedule();
    void syncAndPersist("settings");
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key !== "AppSettings") return;
    schedule();
  };

  window.addEventListener("timeSync:syncNow", onSyncNow as EventListener);
  window.addEventListener("settingsSaved", onSettingsSaved as EventListener);
  window.addEventListener("storage", onStorage as EventListener);

  schedule();

  managerStop = () => {
    if (stopped) return;
    stopped = true;
    clearTimer();
    window.removeEventListener("timeSync:syncNow", onSyncNow as EventListener);
    window.removeEventListener("settingsSaved", onSettingsSaved as EventListener);
    window.removeEventListener("storage", onStorage as EventListener);
    managerStop = null;
  };

  return managerStop;
}
