import type { NoiseSliceSummary } from "../types/noise";

const STORAGE_KEY = "noise-slices";
export const NOISE_SLICE_STORAGE_KEY = STORAGE_KEY;
export const NOISE_SLICES_UPDATED_EVENT = "noise-slices-updated";
const RETENTION_MS = 24 * 60 * 60 * 1000;

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
  return {
    ...slice,
    start: Math.round(slice.start),
    end: Math.round(slice.end),
    frames: Math.max(0, Math.round(slice.frames)),
    raw: {
      avgDbfs: round(slice.raw.avgDbfs, 3),
      maxDbfs: round(slice.raw.maxDbfs, 3),
      p50Dbfs: round(slice.raw.p50Dbfs, 3),
      p95Dbfs: round(slice.raw.p95Dbfs, 3),
      overRatioDbfs: round(slice.raw.overRatioDbfs, 4),
      segmentCount: Math.max(0, Math.round(slice.raw.segmentCount)),
    },
    display: {
      avgDb: round(slice.display.avgDb, 2),
      p95Db: round(slice.display.p95Db, 2),
    },
    score: Math.max(0, Math.min(100, Math.round(slice.score))),
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
    const list = readNoiseSlices();
    const normalized = normalizeSlice(slice);
    list.push(normalized);

    const cutoff = normalized.end - RETENTION_MS;
    const trimmed = list.filter((item) => item.end >= cutoff);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent(NOISE_SLICES_UPDATED_EVENT));
    return trimmed;
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
