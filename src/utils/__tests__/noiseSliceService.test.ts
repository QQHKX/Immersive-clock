import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_NOISE_REPORT_RETENTION_DAYS } from "../../constants/noiseReport";
import type { NoiseSliceSummary } from "../../types/noise";
import { clearNoiseSlices, readNoiseSlices, writeNoiseSlice } from "../noiseSliceService";

function makeSlice(params: { start: number; end: number; score: number }): NoiseSliceSummary {
  return {
    start: params.start,
    end: params.end,
    frames: 1,
    raw: {
      avgDbfs: -40,
      maxDbfs: -20,
      p50Dbfs: -40,
      p95Dbfs: -25,
      overRatioDbfs: 0,
      segmentCount: 0,
    },
    display: {
      avgDb: 40,
      p95Db: 50,
    },
    score: params.score,
    scoreDetail: {
      sustainedPenalty: 0,
      timePenalty: 0,
      segmentPenalty: 0,
      thresholdsUsed: {
        scoreThresholdDbfs: -35,
        segmentMergeGapMs: 5000,
        maxSegmentsPerMin: 6,
      },
      sustainedLevelDbfs: -40,
      overRatioDbfs: 0,
      segmentCount: 0,
      minutes: 1,
    },
  };
}

describe("noiseSliceService", () => {
  beforeEach(() => {
    localStorage.clear();
    clearNoiseSlices();
  });

  it("默认应只保留最近指定天数的切片摘要", () => {
    const dayMs = 24 * 60 * 60 * 1000;
    writeNoiseSlice(makeSlice({ start: 0, end: 1, score: 90 }));
    writeNoiseSlice(
      makeSlice({
        start: DEFAULT_NOISE_REPORT_RETENTION_DAYS * dayMs + 2,
        end: DEFAULT_NOISE_REPORT_RETENTION_DAYS * dayMs + 3,
        score: 80,
      })
    );

    const list = readNoiseSlices();
    expect(list.length).toBe(1);
    expect(list[0].end).toBe(DEFAULT_NOISE_REPORT_RETENTION_DAYS * dayMs + 3);
  });

  it("切片结束时间等于 cutoff 时应被保留", () => {
    const dayMs = 24 * 60 * 60 * 1000;
    writeNoiseSlice(makeSlice({ start: 2, end: 3, score: 90 }));
    writeNoiseSlice(
      makeSlice({
        start: DEFAULT_NOISE_REPORT_RETENTION_DAYS * dayMs + 2,
        end: DEFAULT_NOISE_REPORT_RETENTION_DAYS * dayMs + 3,
        score: 80,
      })
    );

    const list = readNoiseSlices();
    expect(list.length).toBe(2);
  });

  it("保存天数设置为1天时应按1天裁剪", () => {
    localStorage.setItem(
      "AppSettings",
      JSON.stringify({
        noiseControl: {
          reportRetentionDays: 1,
        },
      })
    );
    const dayMs = 24 * 60 * 60 * 1000;
    writeNoiseSlice(makeSlice({ start: 0, end: 1, score: 90 }));
    writeNoiseSlice(makeSlice({ start: dayMs + 2, end: dayMs + 3, score: 80 }));

    const list = readNoiseSlices();
    expect(list.length).toBe(1);
    expect(list[0].end).toBe(dayMs + 3);
  });
});
