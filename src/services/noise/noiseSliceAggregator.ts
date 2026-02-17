import type { NoiseFrameSample, NoiseSliceRawStats, NoiseSliceSummary } from "../../types/noise";
import type { ComputeNoiseScoreOptions } from "../../utils/noiseScoreEngine";
import { computeNoiseSliceScore, DEFAULT_NOISE_SCORE_OPTIONS } from "../../utils/noiseScoreEngine";

import type { NoiseRealtimeRingBuffer } from "./noiseRealtimeRingBuffer";

export interface NoiseSliceAggregatorOptions {
  sliceSec: number;
  frameMs: number;
  score: ComputeNoiseScoreOptions;
  baselineRms: number;
  displayBaselineDb: number;
  ringBuffer: NoiseRealtimeRingBuffer;
}

export interface NoiseSliceAggregatorController {
  onFrame: (frame: NoiseFrameSample) => NoiseSliceSummary | null;
  flush: () => NoiseSliceSummary | null;
  reset: () => void;
  setDisplayMapping: (next: { baselineRms: number; displayBaselineDb: number }) => void;
  setScoreOptions: (next: Partial<ComputeNoiseScoreOptions>) => void;
  setSliceSec: (sliceSec: number) => void;
}

/**
 * 计算已排序数组的分位数
 * @param sorted 已排序的数值数组
 * @param p 分位数 (0-1)
 * @returns 分位数值
 */
function quantileSorted(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const pp = Math.max(0, Math.min(1, p));
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * pp;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

/**
 * 从 dBFS 数组计算能量平均后的 dBFS 值
 * @param dbfsArr dBFS 值数组
 * @returns 能量平均后的 dBFS 值
 */
function computeAvgDbfsFromDbfsArray(dbfsArr: number[]): number {
  if (dbfsArr.length === 0) return -100;
  // 在线性能量域求平均
  const meanSquare = dbfsArr.reduce((s, db) => s + Math.pow(10, db / 10), 0) / dbfsArr.length;
  const overallRms = Math.sqrt(meanSquare);
  const avgDbfs = 20 * Math.log10(Math.max(overallRms, 1e-12));
  return Math.max(-100, Math.min(0, avgDbfs));
}

/**
 * 从 dBFS 数组计算线性域分位数后的 dBFS 值
 * @param dbfsArr dBFS 值数组
 * @param p 分位数 (0-1)
 * @returns 线性域分位数后的 dBFS 值
 */
function computeQuantileFromDbfsArray(dbfsArr: number[], p: number): number {
  if (dbfsArr.length === 0) return -100;
  // 转换到线性域
  const rmsArr = dbfsArr.map((db) => Math.pow(10, db / 20));
  rmsArr.sort((a, b) => a - b);
  // 计算分位数
  const idx = (rmsArr.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const w = idx - lo;
  const quantileRms = lo === hi ? rmsArr[lo] : rmsArr[lo] * (1 - w) + rmsArr[hi] * w;
  // 转回 dBFS
  return 20 * Math.log10(Math.max(quantileRms, 1e-12));
}

/**
 * 从 RMS 计算显示的分贝值
 * @param params 包含当前 RMS、基准 RMS 和基准分贝的对象
 * @returns 显示的分贝值，范围限制在 20 到 100 dB
 */
function computeDisplayDbFromRms(params: {
  rms: number;
  baselineRms: number;
  displayBaselineDb: number;
}): number {
  const safeRms = Math.max(1e-12, params.rms);
  let displayDb: number;
  if (params.baselineRms > 0) {
    displayDb =
      params.displayBaselineDb + 20 * Math.log10(safeRms / Math.max(1e-12, params.baselineRms));
  } else {
    displayDb = 20 * Math.log10(safeRms / 1e-3) + 60;
  }
  return Math.max(20, Math.min(100, displayDb));
}

/**
 * 创建噪音片段聚合器
 * @param options 配置选项
 * @returns 返回包含 onFrame, flush, reset 等方法的对象
 */
export function createNoiseSliceAggregator(
  options: NoiseSliceAggregatorOptions
): NoiseSliceAggregatorController {
  let sliceMs = Math.max(1000, Math.round(options.sliceSec * 1000));
  const frameMs = Math.max(10, Math.round(options.frameMs));
  let scoreOpt: ComputeNoiseScoreOptions = {
    ...DEFAULT_NOISE_SCORE_OPTIONS,
    ...(options.score ?? DEFAULT_NOISE_SCORE_OPTIONS),
  };

  let baselineRms = options.baselineRms;
  let displayBaselineDb = options.displayBaselineDb;
  const ringBuffer = options.ringBuffer;

  let sliceStart: number | null = null;
  let frames = 0;
  let sumDbfs = 0;
  let sumDisplayDb = 0;
  let maxDbfs = -Infinity;
  let aboveFrames = 0;
  let aboveDurationMs = 0;
  let segmentCount = 0;
  let lastAbove = false;
  let lastSegmentEndTs: number | null = null;
  let lastFrameTs: number | null = null;
  let sampledDurationMs = 0;
  let gapCount = 0;
  let maxGapMs = 0;
  const dbfsValues: number[] = [];
  const displayValues: number[] = [];

  /** 无效帧阈值：低于此值视为静音/无效信号，跳过统计 */
  const INVALID_DBFS_THRESHOLD = -90;

  const reset = () => {
    sliceStart = null;
    frames = 0;
    sumDbfs = 0;
    sumDisplayDb = 0;
    maxDbfs = -Infinity;
    aboveFrames = 0;
    aboveDurationMs = 0;
    segmentCount = 0;
    lastAbove = false;
    lastSegmentEndTs = null;
    lastFrameTs = null;
    sampledDurationMs = 0;
    gapCount = 0;
    maxGapMs = 0;
    dbfsValues.length = 0;
    displayValues.length = 0;
  };

  const finalizeSlice = (
    endTs: number,
    nextSliceStartTs: number = endTs
  ): NoiseSliceSummary | null => {
    if (sliceStart === null || frames <= 0) return null;
    const startTs = sliceStart;
    const durationMs = Math.max(1, endTs - startTs);

    const raw: NoiseSliceRawStats = {
      avgDbfs: computeAvgDbfsFromDbfsArray(dbfsValues),
      maxDbfs: maxDbfs === -Infinity ? 0 : maxDbfs,
      p50Dbfs: computeQuantileFromDbfsArray(dbfsValues, 0.5),
      p95Dbfs: computeQuantileFromDbfsArray(dbfsValues, 0.95),
      overRatioDbfs: sampledDurationMs > 0 ? aboveDurationMs / sampledDurationMs : 0,
      segmentCount,
      sampledDurationMs: Math.max(0, Math.round(sampledDurationMs)),
      gapCount: Math.max(0, Math.round(gapCount)),
      maxGapMs: Math.max(0, Math.round(maxGapMs)),
    };

    const display = {
      avgDb: sumDisplayDb / frames,
      p95Db: quantileSorted(displayValues, 0.95),
    };

    const { score, scoreDetail } = computeNoiseSliceScore(raw, durationMs, scoreOpt);

    const summary: NoiseSliceSummary = {
      start: startTs,
      end: endTs,
      frames,
      raw,
      display,
      score,
      scoreDetail,
    };

    reset();
    sliceStart = nextSliceStartTs;
    return summary;
  };

  const onFrame = (frame: NoiseFrameSample): NoiseSliceSummary | null => {
    const gapThresholdMs = Math.max(1000, Math.round(frameMs * 5));
    if (sliceStart === null) sliceStart = frame.t;
    let pendingSlice: NoiseSliceSummary | null = null;

    if (lastFrameTs !== null) {
      const dt = frame.t - lastFrameTs;
      if (dt > 0 && dt <= gapThresholdMs) {
        sampledDurationMs += dt;
      } else if (dt > gapThresholdMs) {
        gapCount += 1;
        if (dt > maxGapMs) maxGapMs = dt;
        pendingSlice = finalizeSlice(lastFrameTs, frame.t);
      }
    }
    lastFrameTs = frame.t;

    const displayDb = computeDisplayDbFromRms({ rms: frame.rms, baselineRms, displayBaselineDb });
    ringBuffer.push({ t: frame.t, dbfs: frame.dbfs, displayDb });

    if (frame.dbfs < INVALID_DBFS_THRESHOLD) {
      return pendingSlice;
    }

    frames += 1;
    sumDbfs += frame.dbfs;
    sumDisplayDb += displayDb;
    if (frame.dbfs > maxDbfs) maxDbfs = frame.dbfs;
    dbfsValues.push(frame.dbfs);
    displayValues.push(displayDb);

    const isAbove = frame.dbfs > scoreOpt.scoreThresholdDbfs;
    if (isAbove) {
      aboveFrames += 1;
      aboveDurationMs += frameMs;
      if (!lastAbove) {
        const merged =
          lastSegmentEndTs !== null && frame.t - lastSegmentEndTs <= scoreOpt.segmentMergeGapMs;
        if (!merged) segmentCount += 1;
        lastAbove = true;
      }
    } else if (lastAbove) {
      lastAbove = false;
      lastSegmentEndTs = frame.t;
    }

    if (frame.t - sliceStart >= sliceMs) {
      return finalizeSlice(frame.t);
    }
    return pendingSlice;
  };

  const flush = () => {
    const now = Date.now();
    if (sliceStart === null) return null;
    return finalizeSlice(lastFrameTs ?? now);
  };

  return {
    onFrame,
    flush,
    reset,
    setDisplayMapping: (next) => {
      baselineRms = next.baselineRms;
      displayBaselineDb = next.displayBaselineDb;
    },
    setScoreOptions: (next) => {
      scoreOpt = { ...scoreOpt, ...next };
    },
    setSliceSec: (next) => {
      sliceMs = Math.max(1000, Math.round(next * 1000));
    },
  };
}
