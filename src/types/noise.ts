export interface NoiseFrameSample {
  t: number;
  rms: number;
  dbfs: number;
  peak?: number;
}

export interface NoiseSliceRawStats {
  avgDbfs: number;
  maxDbfs: number;
  p50Dbfs: number;
  p95Dbfs: number;
  overRatioDbfs: number;
  segmentCount: number;
}

export interface NoiseSliceDisplayStats {
  avgDb: number;
  p95Db: number;
}

export interface NoiseScoreBreakdown {
  sustainedPenalty: number;
  timePenalty: number;
  segmentPenalty: number;
  thresholdsUsed: {
    scoreThresholdDbfs: number;
    segmentMergeGapMs: number;
    maxSegmentsPerMin: number;
  };
  sustainedLevelDbfs: number;
  overRatioDbfs: number;
  segmentCount: number;
  minutes: number;
}

export interface NoiseSliceSummary {
  start: number;
  end: number;
  frames: number;
  raw: NoiseSliceRawStats;
  display: NoiseSliceDisplayStats;
  score: number;
  scoreDetail: NoiseScoreBreakdown;
}
