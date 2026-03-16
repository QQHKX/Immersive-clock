export type ErrorCenterLevel = "error" | "warn" | "info" | "debug";
export type ErrorCenterMode = "off" | "memory" | "persist";

export interface ErrorCenterRecord {
  id: string;
  ts: number;
  lastTs: number;
  level: ErrorCenterLevel;
  source: string;
  title: string;
  message: string;
  stack?: string;
  extra?: Record<string, unknown>;
  count: number;
}

export type ErrorCenterListener = (records: ReadonlyArray<ErrorCenterRecord>) => void;

const ERROR_CENTER_STORAGE_KEY = "error-center.records";
const MAX_RECORDS = 200;
const MERGE_WINDOW_MS = 5000;

let initialized = false;
let errorCenterMode: ErrorCenterMode = "off";
let records: ErrorCenterRecord[] = [];
const listeners = new Set<ErrorCenterListener>();

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message || String(value);
  if (value === null || value === undefined) return "";
  return safeJsonStringify(value);
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function signatureOf(
  input: Pick<ErrorCenterRecord, "level" | "source" | "title" | "message">
): string {
  return `${input.level}::${input.source}::${input.title}::${input.message}`;
}

function notify() {
  const snapshot = records.slice();
  for (const l of listeners) {
    try {
      l(snapshot);
    } catch {
      /* ignore */
    }
  }
}

function loadFromStorage(): ErrorCenterRecord[] {
  try {
    const raw = localStorage.getItem(ERROR_CENTER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x === "object")
      .map((x) => x as ErrorCenterRecord)
      .filter(
        (x) =>
          typeof x.ts === "number" && typeof x.title === "string" && typeof x.message === "string"
      )
      .slice(-MAX_RECORDS);
  } catch {
    return [];
  }
}

/**
 * 清理错误中心的本地存储
 */
function clearErrorCenterStorage(): void {
  try {
    localStorage.removeItem(ERROR_CENTER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function persistToStorage() {
  if (errorCenterMode !== "persist") return;
  try {
    localStorage.setItem(ERROR_CENTER_STORAGE_KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
  } catch {
    /* ignore */
  }
}

/**
 * 设置错误与调试记录模式
 */
export function setErrorCenterMode(mode: ErrorCenterMode): void {
  const nextMode: ErrorCenterMode = mode === "persist" || mode === "memory" ? mode : "off";
  if (errorCenterMode === nextMode) return;
  const prevMode = errorCenterMode;
  errorCenterMode = nextMode;
  if (prevMode === "persist" && nextMode !== "persist") {
    clearErrorCenterStorage();
  }
  if (nextMode === "persist") {
    records = loadFromStorage();
  } else if (nextMode === "off") {
    records = [];
    clearErrorCenterStorage();
  } else if (prevMode === "off") {
    records = [];
  }
  notify();
}

/**
 * 判断错误与调试记录是否启用
 */
export function isErrorCenterActive(): boolean {
  return errorCenterMode !== "off";
}

export function getErrorCenterRecords(): ReadonlyArray<ErrorCenterRecord> {
  return records;
}

export function subscribeErrorCenter(listener: ErrorCenterListener): () => void {
  listeners.add(listener);
  try {
    listener(records.slice());
  } catch {
    /* ignore */
  }
  return () => {
    listeners.delete(listener);
  };
}

export function clearErrorCenter(): void {
  records = [];
  if (errorCenterMode === "persist") {
    persistToStorage();
  } else {
    clearErrorCenterStorage();
  }
  notify();
}

export function exportErrorCenterJson(): string {
  return JSON.stringify(records.slice(), null, 2);
}

export function pushErrorCenterRecord(input: {
  level: ErrorCenterLevel;
  source: string;
  title: string;
  message: unknown;
  stack?: unknown;
  extra?: Record<string, unknown>;
  ts?: number;
}): ErrorCenterRecord | null {
  if (errorCenterMode === "off") {
    return null;
  }
  const ts = typeof input.ts === "number" ? input.ts : Date.now();
  const normalized = {
    level: input.level,
    source: input.source,
    title: String(input.title || ""),
    message: normalizeMessage(input.message),
  };
  const sig = signatureOf(normalized);
  const lastIdx = (() => {
    for (let i = records.length - 1; i >= 0; i--) {
      const r = records[i];
      if (signatureOf(r) === sig) return i;
    }
    return -1;
  })();

  if (lastIdx >= 0) {
    const last = records[lastIdx];
    if (ts - last.lastTs <= MERGE_WINDOW_MS) {
      const next: ErrorCenterRecord = {
        ...last,
        lastTs: ts,
        count: Math.max(1, (last.count || 1) + 1),
      };
      records = [...records.slice(0, lastIdx), next, ...records.slice(lastIdx + 1)];
      persistToStorage();
      notify();
      return next;
    }
  }

  const rec: ErrorCenterRecord = {
    id: genId(),
    ts,
    lastTs: ts,
    level: normalized.level,
    source: normalized.source,
    title: normalized.title,
    message: normalized.message,
    stack: input.stack ? normalizeMessage(input.stack) : undefined,
    extra: input.extra,
    count: 1,
  };
  records = [...records, rec].slice(-MAX_RECORDS);
  persistToStorage();
  notify();
  return rec;
}

export function dispatchErrorPopup(detail: {
  title: string;
  message: unknown;
  source?: string;
}): void {
  pushErrorCenterRecord({
    level: "error",
    source: detail.source || "errorPopup",
    title: detail.title,
    message: detail.message,
  });
  window.dispatchEvent(
    new CustomEvent("messagePopup:open", {
      detail: {
        type: "error",
        title: detail.title,
        message: normalizeMessage(detail.message),
      },
    })
  );
}

export function initErrorCenterGlobalCapture(): void {
  if (initialized) return;
  initialized = true;

  if (errorCenterMode === "persist") {
    records = loadFromStorage();
  } else if (errorCenterMode === "off") {
    records = [];
    clearErrorCenterStorage();
  }

  window.addEventListener("messagePopup:open", (e: Event) => {
    const detail = (e as CustomEvent).detail || {};
    const type = String(detail.type || "general");
    const title = String(detail.title || "消息提醒");
    const message = detail.message;
    if (type === "error") {
      pushErrorCenterRecord({
        level: "error",
        source: "messagePopup",
        title,
        message,
      });
    } else {
      pushErrorCenterRecord({
        level: "info",
        source: "messagePopup",
        title,
        message,
      });
    }
  });

  window.addEventListener("weatherRefreshDone", (e: Event) => {
    const detail = (e as CustomEvent).detail || {};
    if (detail.status !== "失败") return;
    pushErrorCenterRecord({
      level: "error",
      source: "weather",
      title: "天气获取失败",
      message: detail.errorMessage || "未知错误",
      extra: {
        coords: detail.coords || null,
        coordsSource: detail.coordsSource || null,
      },
    });
  });

  window.addEventListener("weatherLocationRefreshDone", (e: Event) => {
    const detail = (e as CustomEvent).detail || {};
    if (detail.status !== "失败") return;
    pushErrorCenterRecord({
      level: "error",
      source: "weather",
      title: "定位失败",
      message: detail.errorMessage || "未知错误",
      extra: {
        coords: detail.coords || null,
        coordsSource: detail.coordsSource || null,
      },
    });
  });

  window.addEventListener("error", (e: ErrorEvent) => {
    pushErrorCenterRecord({
      level: "error",
      source: "global",
      title: "未捕获异常",
      message: e.message || "未知错误",
      stack: e.error instanceof Error ? e.error.stack : undefined,
      extra: {
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const reason = (e as PromiseRejectionEvent).reason;
    pushErrorCenterRecord({
      level: "error",
      source: "global",
      title: "未处理的 Promise 拒绝",
      message: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}
