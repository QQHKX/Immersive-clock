import {
  NOISE_SCORE_MAX_SEGMENTS_PER_MIN,
  NOISE_SCORE_SEGMENT_MERGE_GAP_MS,
  NOISE_SCORE_THRESHOLD_DBFS,
} from "../constants/noise";
import type { NoiseScoreBreakdown, NoiseSliceRawStats } from "../types/noise";

export interface ComputeNoiseScoreOptions {
  scoreThresholdDbfs: number;
  segmentMergeGapMs: number;
  maxSegmentsPerMin: number;
}

export const DEFAULT_NOISE_SCORE_OPTIONS: ComputeNoiseScoreOptions = {
  scoreThresholdDbfs: NOISE_SCORE_THRESHOLD_DBFS,
  segmentMergeGapMs: NOISE_SCORE_SEGMENT_MERGE_GAP_MS,
  maxSegmentsPerMin: NOISE_SCORE_MAX_SEGMENTS_PER_MIN,
};

/** DBFS 物理最小可表示值 */
const DBFS_MIN_POSSIBLE = -100;
/** DBFS 物理最大可表示值 */
const DBFS_MAX_POSSIBLE = 0;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * 将 DBFS 值限制在有效范围内
 * @param dbfs 原始 DBFS 值
 * @returns 限制后的 DBFS 值
 */
function clampDbfs(dbfs: number): number {
  return Math.max(DBFS_MIN_POSSIBLE, Math.min(DBFS_MAX_POSSIBLE, dbfs));
}

/**
 * 计算噪音切片评分
 * 基于持续电平、时间占比和波动频率进行综合评估
 */
export function computeNoiseSliceScore(
  raw: NoiseSliceRawStats,
  durationMs: number,
  options?: Partial<ComputeNoiseScoreOptions>
): { score: number; scoreDetail: NoiseScoreBreakdown } {
  const opt: ComputeNoiseScoreOptions = { ...DEFAULT_NOISE_SCORE_OPTIONS, ...(options ?? {}) };
  const sampledDurationMs =
    typeof raw.sampledDurationMs === "number" && Number.isFinite(raw.sampledDurationMs)
      ? Math.max(0, raw.sampledDurationMs)
      : null;
  const effectiveDurationMs =
    sampledDurationMs && sampledDurationMs > 0 ? sampledDurationMs : durationMs;
  const minutes = Math.max(1e-6, effectiveDurationMs / 60_000);
  const segmentsPerMin = raw.segmentCount / minutes;

  const clampedP50Dbfs = clampDbfs(raw.p50Dbfs);
  const sustainedLevelDbfs = clampedP50Dbfs;
  const sustainedOver = Math.max(0, sustainedLevelDbfs - opt.scoreThresholdDbfs);
  const sustainedPenalty = clamp01(sustainedOver / 6);

  const timePenalty = clamp01(raw.overRatioDbfs / 0.3);
  const segmentPenalty = clamp01(segmentsPerMin / Math.max(1e-6, opt.maxSegmentsPerMin));

  const penalty = 0.4 * sustainedPenalty + 0.3 * timePenalty + 0.3 * segmentPenalty;
  const rawScore = 100 * (1 - penalty);
  const score = Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));

  return {
    score,
    scoreDetail: {
      sustainedPenalty,
      timePenalty,
      segmentPenalty,
      thresholdsUsed: {
        scoreThresholdDbfs: opt.scoreThresholdDbfs,
        segmentMergeGapMs: opt.segmentMergeGapMs,
        maxSegmentsPerMin: opt.maxSegmentsPerMin,
      },
      sustainedLevelDbfs,
      overRatioDbfs: raw.overRatioDbfs,
      segmentCount: raw.segmentCount,
      minutes,
      durationMs,
      sampledDurationMs: sampledDurationMs ?? undefined,
      coverageRatio:
        sampledDurationMs && sampledDurationMs > 0
          ? clamp01(sampledDurationMs / Math.max(1, durationMs))
          : undefined,
    },
  };
}
