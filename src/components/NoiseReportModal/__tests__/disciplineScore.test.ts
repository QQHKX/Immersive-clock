import { describe, expect, it } from "vitest";

import { computeDisciplineScore, type NoiseReportPeriod, type NoiseSampleForScore } from "../NoiseReportModal";

describe("computeDisciplineScore", () => {
  it("整体分贝平移时评分保持一致", () => {
    const period: NoiseReportPeriod = {
      id: "p1",
      name: "晚自习",
      start: new Date(0),
      end: new Date(10 * 60 * 1000),
    };

    const makeSamples = (shift: number): NoiseSampleForScore[] => {
      const start = period.start.getTime();
      const end = period.end.getTime();
      const list: NoiseSampleForScore[] = [];
      for (let t = start; t <= end; t += 2000) {
        let v = 40 + shift;
        if (t % 60_000 === 0) v = 65 + shift;
        if (t % 90_000 === 0) v = 58 + shift;
        list.push({ t, v });
      }
      return list;
    };

    const base = computeDisciplineScore(period, makeSamples(0));
    const plus15 = computeDisciplineScore(period, makeSamples(15));
    const minus10 = computeDisciplineScore(period, makeSamples(-10));

    expect(base.score).toBeDefined();
    expect(base.score).toBe(plus15.score);
    expect(base.score).toBe(minus10.score);
    expect(base.impactCount).toBe(plus15.impactCount);
    expect(base.impactCount).toBe(minus10.impactCount);
  });
});

