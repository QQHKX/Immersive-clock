import { describe, expect, it } from "vitest";

import { DEFAULT_NOISE_REPORT_RETENTION_DAYS } from "../../constants/noiseReport";
import type { NoiseSliceSummary } from "../../types/noise";
import type { StudyPeriod } from "../../types/studySchedule";
import { buildNoiseHistoryListItems } from "../noiseHistoryBuilder";

/**
 * 构造测试切片（函数级注释：生成最小可用的 NoiseSliceSummary 结构用于历史聚合测试）
 */
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

describe("noiseHistoryBuilder", () => {
  it("应按重叠时长对 score 加权平均", () => {
    const schedule: StudyPeriod[] = [
      { id: "1", name: "第1节自习", startTime: "10:00", endTime: "11:00" },
    ];
    const start1 = new Date(2026, 0, 2, 10, 0, 0, 0).getTime();
    const mid = new Date(2026, 0, 2, 10, 30, 0, 0).getTime();
    const end1 = new Date(2026, 0, 2, 11, 0, 0, 0).getTime();

    const slices: NoiseSliceSummary[] = [
      makeSlice({ start: start1, end: mid, score: 80 }),
      makeSlice({ start: mid, end: end1, score: 100 }),
    ];

    const items = buildNoiseHistoryListItems({ slices, schedule, windowMs: 24 * 60 * 60 * 1000 });
    expect(items.length).toBe(1);
    expect(items[0].period.name).toBe("第1节自习");
    expect(items[0].avgScore).not.toBeNull();
    expect(items[0].avgScore!).toBeCloseTo(90, 5);
    expect(items[0].coverageRatio).toBeCloseTo(1, 6);
  });

  it("应按结束时间倒序排序", () => {
    const schedule: StudyPeriod[] = [
      { id: "1", name: "A", startTime: "10:00", endTime: "11:00" },
      { id: "2", name: "B", startTime: "12:00", endTime: "13:00" },
    ];
    const aStart = new Date(2026, 0, 2, 10, 0, 0, 0).getTime();
    const aEnd = new Date(2026, 0, 2, 11, 0, 0, 0).getTime();
    const bStart = new Date(2026, 0, 2, 12, 0, 0, 0).getTime();
    const bEnd = new Date(2026, 0, 2, 13, 0, 0, 0).getTime();

    const slices: NoiseSliceSummary[] = [
      makeSlice({ start: aStart, end: aEnd, score: 90 }),
      makeSlice({ start: bStart, end: bEnd, score: 80 }),
    ];

    const items = buildNoiseHistoryListItems({ slices, schedule });
    expect(items.map((x) => x.period.name)).toEqual(["B", "A"]);
  });

  it("无重叠数据时不应生成条目", () => {
    const schedule: StudyPeriod[] = [{ id: "1", name: "A", startTime: "10:00", endTime: "11:00" }];
    const sliceStart = new Date(2026, 0, 2, 8, 0, 0, 0).getTime();
    const sliceEnd = new Date(2026, 0, 2, 9, 0, 0, 0).getTime();
    const slices: NoiseSliceSummary[] = [
      makeSlice({ start: sliceStart, end: sliceEnd, score: 90 }),
    ];

    const items = buildNoiseHistoryListItems({ slices, schedule });
    expect(items.length).toBe(0);
  });

  it("默认窗口应为最近指定天数", () => {
    const schedule: StudyPeriod[] = [
      { id: "1", name: "第1节自习", startTime: "10:00", endTime: "11:00" },
    ];
    const dayMs = 24 * 60 * 60 * 1000;
    const recentStart = new Date(2026, 0, 20, 10, 0, 0, 0).getTime();
    const recentEnd = new Date(2026, 0, 20, 11, 0, 0, 0).getTime();
    const oldStart = recentStart - (DEFAULT_NOISE_REPORT_RETENTION_DAYS + 1) * dayMs;
    const oldEnd = recentEnd - (DEFAULT_NOISE_REPORT_RETENTION_DAYS + 1) * dayMs;

    const slices: NoiseSliceSummary[] = [
      makeSlice({ start: oldStart, end: oldEnd, score: 80 }),
      makeSlice({ start: recentStart, end: recentEnd, score: 90 }),
    ];

    const items = buildNoiseHistoryListItems({ slices, schedule });
    expect(items.length).toBe(1);
    expect(items[0].period.start.getTime()).toBe(recentStart);
  });
});
