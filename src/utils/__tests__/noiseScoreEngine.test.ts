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
    expect(manySegments.scoreDetail.segmentPenalty).toBeGreaterThan(fewSegments.scoreDetail.segmentPenalty);
  });
});

