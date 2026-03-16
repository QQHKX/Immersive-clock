import { describe, expect, it } from "vitest";

import {
  computeMinutelyRainStats,
  resolveMinutelyRainPhase,
  shouldTriggerCriticalRefresh,
} from "../minutelyPrecipLogic";

/**
 * 构建分钟级测试缓存（函数级中文注释：基于基准时间和5分钟步长生成分钟级降水序列）
 */
function createMinutelyCache(baseMs: number, precipSeries: number[]) {
  return {
    updateTime: new Date(baseMs).toISOString(),
    fetchedAt: baseMs,
    minutely: precipSeries.map((precip, idx) => ({
      fxTime: new Date(baseMs + idx * 5 * 60 * 1000).toISOString(),
      precip: String(precip),
    })),
  };
}

describe("minutelyPrecipLogic", () => {
  it("无雨场景应返回 DRY 且无开始结束时间", () => {
    const base = Date.parse("2026-03-07T10:00:00+08:00");
    const cache = createMinutelyCache(base, [0, 0, 0, 0, 0]);
    const stats = computeMinutelyRainStats(cache, base + 2 * 60 * 1000);
    const phase = resolveMinutelyRainPhase(stats, null);
    expect(stats.hasRain).toBe(false);
    expect(stats.isRainingNow).toBe(false);
    expect(stats.nextRainStartAt).toBeNull();
    expect(stats.rainEndAt).toBeNull();
    expect(phase).toBe("DRY");
  });

  it("将雨场景应返回 PRE_RAIN 且提供开始与结束时间", () => {
    const base = Date.parse("2026-03-07T10:00:00+08:00");
    const cache = createMinutelyCache(base, [0, 0.2, 0.3, 0, 0]);
    const stats = computeMinutelyRainStats(cache, base + 1 * 60 * 1000);
    const phase = resolveMinutelyRainPhase(stats, null);
    expect(stats.hasRain).toBe(true);
    expect(stats.isRainingNow).toBe(false);
    expect(stats.nextRainStartAt).toBe(base + 5 * 60 * 1000);
    expect(stats.rainEndAt).toBe(base + 15 * 60 * 1000);
    expect(stats.leadMinutes).toBeGreaterThan(0);
    expect(phase).toBe("PRE_RAIN");
  });

  it("正在降雨场景应立即识别并给出剩余分钟", () => {
    const base = Date.parse("2026-03-07T10:00:00+08:00");
    const cache = createMinutelyCache(base, [0.2, 0.3, 0, 0, 0]);
    const now = base + 2 * 60 * 1000;
    const stats = computeMinutelyRainStats(cache, now);
    const phase = resolveMinutelyRainPhase(stats, "PRE_RAIN");
    expect(stats.isRainingNow).toBe(true);
    expect(stats.remainingMinutes).not.toBeNull();
    expect(stats.rainEndAt).toBe(base + 10 * 60 * 1000);
    expect(phase).toBe("RAINING");
  });

  it("由降雨转无雨应进入 POST_RAIN 过渡态", () => {
    const base = Date.parse("2026-03-07T10:00:00+08:00");
    const cache = createMinutelyCache(base, [0, 0, 0, 0]);
    const stats = computeMinutelyRainStats(cache, base + 30 * 60 * 1000);
    const phase = resolveMinutelyRainPhase(stats, "RAINING");
    expect(phase).toBe("POST_RAIN");
  });

  it("关键窗口条件满足时应允许加密刷新", () => {
    const shouldRefresh = shouldTriggerCriticalRefresh({
      phase: "PRE_RAIN",
      leadMinutes: 8,
      remainingMinutes: null,
      nowMs: 2000,
      lastApiFetchAt: 1000,
      lastCriticalFetchAt: 0,
      baseIntervalMs: 60 * 60 * 1000,
      criticalWindowMinutes: 10,
      minCriticalGapMs: 500,
    });
    expect(shouldRefresh).toBe(true);
  });

  it("关键窗口不满足时不应触发加密刷新", () => {
    const shouldRefresh = shouldTriggerCriticalRefresh({
      phase: "DRY",
      leadMinutes: null,
      remainingMinutes: null,
      nowMs: 2000,
      lastApiFetchAt: 1000,
      lastCriticalFetchAt: 1900,
      baseIntervalMs: 60 * 60 * 1000,
      criticalWindowMinutes: 10,
      minCriticalGapMs: 500,
    });
    expect(shouldRefresh).toBe(false);
  });
});
