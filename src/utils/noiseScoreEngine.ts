import type { NoiseScoreBreakdown, NoiseSliceRawStats } from "../types/noise";

export interface ComputeNoiseScoreOptions {
  scoreThresholdDbfs: number;
  segmentMergeGapMs: number;
  maxSegmentsPerMin: number;
}

export const DEFAULT_NOISE_SCORE_OPTIONS: ComputeNoiseScoreOptions = {
  scoreThresholdDbfs: -35,
  segmentMergeGapMs: 300,
  maxSegmentsPerMin: 6,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function computeNoiseSliceScore(
  raw: NoiseSliceRawStats,
  durationMs: number,
  options?: Partial<ComputeNoiseScoreOptions>
): { score: number; scoreDetail: NoiseScoreBreakdown } {
  const opt: ComputeNoiseScoreOptions = { ...DEFAULT_NOISE_SCORE_OPTIONS, ...(options ?? {}) };
  const minutes = Math.max(1e-6, durationMs / 60_000);
  const segmentsPerMin = raw.segmentCount / minutes;

  const sustainedLevelDbfs = raw.p50Dbfs;
  const sustainedOver = Math.max(0, sustainedLevelDbfs - opt.scoreThresholdDbfs);
  const sustainedPenalty = clamp01(sustainedOver / 6);

  const timePenalty = clamp01(raw.overRatioDbfs / 0.3);
  const segmentPenalty = clamp01(segmentsPerMin / Math.max(1e-6, opt.maxSegmentsPerMin));

  const penalty = 0.55 * sustainedPenalty + 0.3 * timePenalty + 0.15 * segmentPenalty;
  const score = Math.max(0, Math.min(100, Math.round(100 * (1 - penalty))));

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
    },
  };
}
