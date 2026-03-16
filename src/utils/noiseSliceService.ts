import { DEFAULT_NOISE_REPORT_RETENTION_DAYS } from "../constants/noiseReport";
import type { NoiseSliceSummary } from "../types/noise";

import { getAppSettings } from "./appSettings";

const STORAGE_KEY = "noise-slices";
export const NOISE_SLICE_STORAGE_KEY = STORAGE_KEY;
export const NOISE_SLICES_UPDATED_EVENT = "noise-slices-updated";
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RETENTION_DAYS = DEFAULT_NOISE_REPORT_RETENTION_DAYS;

let cachedQuotaBytes: number | null = null;
let quotaEstimateStarted = false;

function ensureQuotaEstimated(): void {
  if (quotaEstimateStarted) return;
  quotaEstimateStarted = true;
  try {
    if (!("storage" in navigator) || typeof navigator.storage.estimate !== "function") return;
    void navigator.storage
      .estimate()
      .then((estimate) => {
        const quota = typeof estimate.quota === "number" ? estimate.quota : undefined;
        if (typeof quota === "number" && Number.isFinite(quota) && quota > 0) {
          cachedQuotaBytes = quota;
        }
      })
      .catch(() => {
        quotaEstimateStarted = true;
      });
  } catch {
    quotaEstimateStarted = true;
  }
}

function getRetentionMs(): number {
  try {
    const raw = getAppSettings().noiseControl.reportRetentionDays;
    const days =
      typeof raw === "number" && Number.isFinite(raw) && raw > 0
        ? Math.round(raw)
        : DEFAULT_RETENTION_DAYS;
    return Math.max(1, days) * DAY_MS;
  } catch {
    return DEFAULT_RETENTION_DAYS * DAY_MS;
  }
}

function estimateStringBytes(str: string): number {
  return str.length * 2;
}

function trimByMaxBytes(list: NoiseSliceSummary[], maxBytes: number): NoiseSliceSummary[] {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) return list;
  let trimmed = list;
  let serialized = JSON.stringify(trimmed);
  while (trimmed.length > 0 && estimateStringBytes(serialized) > maxBytes) {
    trimmed = trimmed.slice(1);
    serialized = JSON.stringify(trimmed);
  }
  return trimmed;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNoiseSliceSummary(value: unknown): value is NoiseSliceSummary {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<NoiseSliceSummary>;
  const raw = v.raw as unknown;
  const display = v.display as unknown;
  const rawObj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const displayObj =
    display && typeof display === "object" ? (display as Record<string, unknown>) : null;
  return (
    isFiniteNumber(v.start) &&
    isFiniteNumber(v.end) &&
    isFiniteNumber(v.frames) &&
    !!rawObj &&
    isFiniteNumber(rawObj.avgDbfs) &&
    isFiniteNumber(rawObj.maxDbfs) &&
    isFiniteNumber(rawObj.p50Dbfs) &&
    isFiniteNumber(rawObj.p95Dbfs) &&
    isFiniteNumber(rawObj.overRatioDbfs) &&
    isFiniteNumber(rawObj.segmentCount) &&
    !!displayObj &&
    isFiniteNumber(displayObj.avgDb) &&
    isFiniteNumber(displayObj.p95Db) &&
    isFiniteNumber(v.score) &&
    !!v.scoreDetail &&
    typeof v.scoreDetail === "object"
  );
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function normalizeSlice(slice: NoiseSliceSummary): NoiseSliceSummary {
  const sampledDurationMs = isFiniteNumber(slice.raw.sampledDurationMs)
    ? Math.max(0, Math.round(slice.raw.sampledDurationMs))
    : undefined;
  const gapCount = isFiniteNumber(slice.raw.gapCount)
    ? Math.max(0, Math.round(slice.raw.gapCount))
    : undefined;
  const maxGapMs = isFiniteNumber(slice.raw.maxGapMs)
    ? Math.max(0, Math.round(slice.raw.maxGapMs))
    : undefined;

  return {
    ...slice,
    start: Math.round(slice.start),
    end: Math.round(slice.end),
    frames: Math.max(0, Math.round(slice.frames)),
    raw: {
      ...slice.raw,
      avgDbfs: round(slice.raw.avgDbfs, 3),
      maxDbfs: round(slice.raw.maxDbfs, 3),
      p50Dbfs: round(slice.raw.p50Dbfs, 3),
      p95Dbfs: round(slice.raw.p95Dbfs, 3),
      overRatioDbfs: round(slice.raw.overRatioDbfs, 4),
      segmentCount: Math.max(0, Math.round(slice.raw.segmentCount)),
      sampledDurationMs,
      gapCount,
      maxGapMs,
    },
    display: {
      avgDb: round(slice.display.avgDb, 2),
      p95Db: round(slice.display.p95Db, 2),
    },
    score: Math.max(0, Math.min(100, round(slice.score, 1))),
    scoreDetail: slice.scoreDetail,
  };
}

/**
 * 读取噪音切片历史记录
 */
export function readNoiseSlices(): NoiseSliceSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.filter(isNoiseSliceSummary).map(normalizeSlice);
  } catch {
    return [];
  }
}

/**
 * 写入新的噪音切片
 * 自动清理超出保留时长的旧记录
 */
export function writeNoiseSlice(slice: NoiseSliceSummary): NoiseSliceSummary[] {
  try {
    ensureQuotaEstimated();
    const list = readNoiseSlices();
    const normalized = normalizeSlice(slice);
    list.push(normalized);

    const cutoff = normalized.end - getRetentionMs();
    const timeTrimmed = list.filter((item) => item.end >= cutoff);

    const quotaBytes = cachedQuotaBytes;
    const maxBytes = quotaBytes ? quotaBytes * 0.9 : null;
    let trimmed = maxBytes ? trimByMaxBytes(timeTrimmed, maxBytes) : timeTrimmed;

    while (trimmed.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        window.dispatchEvent(new CustomEvent(NOISE_SLICES_UPDATED_EVENT));
        return trimmed;
      } catch {
        trimmed = trimmed.slice(1);
      }
    }

    localStorage.setItem(STORAGE_KEY, "[]");
    window.dispatchEvent(new CustomEvent(NOISE_SLICES_UPDATED_EVENT));
    return [];
  } catch {
    return readNoiseSlices();
  }
}

/**
 * 清空噪音切片记录
 */
export function clearNoiseSlices(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } finally {
    window.dispatchEvent(new CustomEvent(NOISE_SLICES_UPDATED_EVENT));
  }
}

/**
 * 订阅噪音切片更新事件
 */
export function subscribeNoiseSlicesUpdated(handler: () => void): () => void {
  window.addEventListener(NOISE_SLICES_UPDATED_EVENT, handler);
  return () => window.removeEventListener(NOISE_SLICES_UPDATED_EVENT, handler);
}
