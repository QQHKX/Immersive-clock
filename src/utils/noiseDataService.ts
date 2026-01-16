/**
 * 噪音数据服务：统一读写与通知机制
 * 所有模块应通过该服务获取与写入噪音样本，避免直接访问 localStorage。
 */

export type NoiseState = "quiet" | "noisy";

export interface NoiseSample {
  t: number; // 时间戳（ms）
  v: number; // 平均分贝值（dB）
  s: NoiseState; // 状态：安静或吵闹
}

const STORAGE_KEY = "noise-samples";
export const NOISE_SAMPLE_STORAGE_KEY = STORAGE_KEY;
export const NOISE_SAMPLES_UPDATED_EVENT = "noise-samples-updated";
const RETENTION_MS = 24 * 60 * 60 * 1000; // 保留最近24小时

/** 将噪音分贝值四舍五入保留两位小数（用于持久化，避免存储过长小数） */
function normalizeDbValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function readNoiseSamples(): NoiseSample[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: NoiseSample[] = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function writeNoiseSample(sample: NoiseSample): NoiseSample[] {
  try {
    const list = readNoiseSamples();
    list.push({ ...sample, v: normalizeDbValue(sample.v) });
    const cutoff = sample.t - RETENTION_MS;
    const trimmed = list.filter((item) => item.t >= cutoff);
    const normalized = trimmed.map((item) => ({ ...item, v: normalizeDbValue(item.v) }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    // 通知订阅者：样本已更新
    window.dispatchEvent(new CustomEvent(NOISE_SAMPLES_UPDATED_EVENT));
    return normalized;
  } catch {
    // 写入失败不抛出，返回现状
    return readNoiseSamples();
  }
}

export function clearNoiseSamples(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } finally {
    window.dispatchEvent(new CustomEvent(NOISE_SAMPLES_UPDATED_EVENT));
  }
}

export function subscribeNoiseSamplesUpdated(handler: () => void): () => void {
  window.addEventListener(NOISE_SAMPLES_UPDATED_EVENT, handler);
  return () => window.removeEventListener(NOISE_SAMPLES_UPDATED_EVENT, handler);
}
