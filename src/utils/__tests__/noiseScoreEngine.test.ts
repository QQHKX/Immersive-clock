import { describe, expect, it } from "vitest";

import { computeNoiseSliceScore } from "../noiseScoreEngine";

describe("noiseScoreEngine", () => {
  it("安静切片应得到高分", () => {
    const { score, scoreDetail } = computeNoiseSliceScore(
      {
        avgDbfs: -55,
        maxDbfs: -45,
        p50Dbfs: -55,
        p95Dbfs: -48,
        overRatioDbfs: 0,
        segmentCount: 0,
      },
      20_000
    );

    expect(score).toBeGreaterThanOrEqual(95);
    expect(scoreDetail.sustainedPenalty).toBe(0);
    expect(scoreDetail.timePenalty).toBe(0);
    expect(scoreDetail.segmentPenalty).toBe(0);
  });

  it("持续吵闹（p50Dbfs 高）应明显扣分", () => {
    const quiet = computeNoiseSliceScore(
      {
        avgDbfs: -55,
        maxDbfs: -45,
        p50Dbfs: -55,
        p95Dbfs: -48,
        overRatioDbfs: 0,
        segmentCount: 0,
      },
      20_000
    );

    const sustainedNoisy = computeNoiseSliceScore(
      {
        avgDbfs: -25,
        maxDbfs: -20,
        p50Dbfs: -25,
        p95Dbfs: -22,
        overRatioDbfs: 1,
        segmentCount: 1,
      },
      20_000
    );

    expect(sustainedNoisy.score).toBeLessThan(quiet.score);
    expect(sustainedNoisy.scoreDetail.sustainedPenalty).toBeGreaterThan(0.8);
  });

  it("同等持续性下，事件段数更多应更低分", () => {
    const baseRaw = {
      avgDbfs: -34,
      maxDbfs: -20,
      p50Dbfs: -34,
      p95Dbfs: -28,
      overRatioDbfs: 0.2,
      segmentCount: 0,
    };

    const fewSegments = computeNoiseSliceScore({ ...baseRaw, segmentCount: 1 }, 60_000, {
      maxSegmentsPerMin: 6,
    });
    const manySegments = computeNoiseSliceScore({ ...baseRaw, segmentCount: 20 }, 60_000, {
      maxSegmentsPerMin: 6,
    });

    expect(manySegments.score).toBeLessThan(fewSegments.score);
    expect(manySegments.scoreDetail.segmentPenalty).toBeGreaterThan(
      fewSegments.scoreDetail.segmentPenalty
    );
  });

  it("存在采样覆盖信息时，应使用有效采样时长计算事件密度", () => {
    const baseRaw = {
      avgDbfs: -34,
      maxDbfs: -20,
      p50Dbfs: -34,
      p95Dbfs: -28,
      overRatioDbfs: 0.2,
      segmentCount: 2,
    };

    const full = computeNoiseSliceScore(baseRaw, 60_000, { maxSegmentsPerMin: 6 });
    const partial = computeNoiseSliceScore({ ...baseRaw, sampledDurationMs: 10_000 }, 60_000, {
      maxSegmentsPerMin: 6,
    });

    expect(partial.score).toBeLessThan(full.score);
    expect(partial.scoreDetail.coverageRatio).toBeDefined();
    expect(partial.scoreDetail.coverageRatio!).toBeCloseTo(10_000 / 60_000, 5);
  });

  it("评分应保留1位小数", () => {
    const { score } = computeNoiseSliceScore(
      {
        avgDbfs: -44.4,
        maxDbfs: -30,
        p50Dbfs: -44.4,
        p95Dbfs: -40,
        overRatioDbfs: 0,
        segmentCount: 0,
      },
      60_000,
      { scoreThresholdDbfs: -45 }
    );

    expect(score).toBeCloseTo(96.0, 6);
    expect(score * 10).toBeCloseTo(Math.round(score * 10), 8);
  });

  it("异常低值 p50Dbfs 应被限制在有效范围内", () => {
    const { score, scoreDetail } = computeNoiseSliceScore(
      {
        avgDbfs: -135,
        maxDbfs: -100,
        p50Dbfs: -135,
        p95Dbfs: -120,
        overRatioDbfs: 0,
        segmentCount: 0,
      },
      30_000
    );

    expect(scoreDetail.sustainedLevelDbfs).toBeGreaterThanOrEqual(-100);
    expect(scoreDetail.sustainedLevelDbfs).toBeLessThanOrEqual(0);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
