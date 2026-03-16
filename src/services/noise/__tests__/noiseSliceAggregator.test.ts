import { describe, expect, it } from "vitest";

import type { NoiseFrameSample } from "../../../types/noise";
import { createNoiseRealtimeRingBuffer } from "../noiseRealtimeRingBuffer";
import { createNoiseSliceAggregator } from "../noiseSliceAggregator";

function rmsFromDbfs(dbfs: number): number {
  return Math.pow(10, dbfs / 20);
}

function frame(t: number, dbfs: number): NoiseFrameSample {
  const rms = rmsFromDbfs(dbfs);
  return { t, rms, dbfs, peak: rms };
}

describe("noiseSliceAggregator", () => {
  it("应按 mergeGap 合并事件段，并输出切片摘要", () => {
    const ringBuffer = createNoiseRealtimeRingBuffer({
      retentionMs: 5 * 60 * 1000,
      capacity: 4096,
    });
    const aggregator = createNoiseSliceAggregator({
      sliceSec: 2,
      frameMs: 100,
      score: { scoreThresholdDbfs: -35, segmentMergeGapMs: 300, maxSegmentsPerMin: 6 },
      baselineRms: 1e-3,
      displayBaselineDb: 40,
      ringBuffer,
    });

    const frames: NoiseFrameSample[] = [
      frame(0, -50),
      frame(100, -30),
      frame(200, -30),
      frame(300, -50),
      frame(400, -50),
      frame(500, -30),
      frame(600, -50),
      frame(950, -30),
      frame(1050, -50),
      frame(1200, -50),
      frame(1500, -50),
      frame(1800, -50),
      frame(2000, -50),
    ];

    let slice = null as ReturnType<typeof aggregator.onFrame>;
    for (const f of frames) {
      const out = aggregator.onFrame(f);
      if (out) slice = out;
    }

    expect(slice).not.toBeNull();
    expect(slice?.raw.segmentCount).toBe(2);
    expect(slice?.raw.overRatioDbfs).toBeGreaterThan(0);
    expect(slice?.frames).toBe(frames.length);
    expect(slice?.raw.sampledDurationMs).toBe(2000);
    expect(slice?.raw.gapCount).toBe(0);

    const points = ringBuffer.snapshot();
    expect(points.length).toBeGreaterThan(0);
  });

  it("出现长缺口时应切断切片并记录缺口信息", () => {
    const ringBuffer = createNoiseRealtimeRingBuffer({
      retentionMs: 5 * 60 * 1000,
      capacity: 4096,
    });
    const aggregator = createNoiseSliceAggregator({
      sliceSec: 60,
      frameMs: 100,
      score: { scoreThresholdDbfs: -35, segmentMergeGapMs: 300, maxSegmentsPerMin: 6 },
      baselineRms: 1e-3,
      displayBaselineDb: 40,
      ringBuffer,
    });

    const out1 = aggregator.onFrame(frame(0, -50));
    expect(out1).toBeNull();
    aggregator.onFrame(frame(100, -50));
    aggregator.onFrame(frame(200, -50));
    aggregator.onFrame(frame(300, -50));
    aggregator.onFrame(frame(400, -50));

    const sliced = aggregator.onFrame(frame(10_000, -50));
    expect(sliced).not.toBeNull();
    expect(sliced?.start).toBe(0);
    expect(sliced?.end).toBe(400);
    expect(sliced?.raw.sampledDurationMs).toBe(400);
    expect(sliced?.raw.gapCount).toBe(1);
    expect(sliced?.raw.maxGapMs).toBeGreaterThan(9000);

    aggregator.onFrame(frame(10_100, -50));
    const last = aggregator.flush();
    expect(last).not.toBeNull();
    expect(last?.start).toBe(10_000);
    expect(last?.end).toBe(10_100);
    expect(last?.raw.sampledDurationMs).toBe(100);
  });

  it("应过滤低于 -90 dB 的无效帧", () => {
    const ringBuffer = createNoiseRealtimeRingBuffer({
      retentionMs: 5 * 60 * 1000,
      capacity: 4096,
    });
    const aggregator = createNoiseSliceAggregator({
      sliceSec: 2,
      frameMs: 100,
      score: { scoreThresholdDbfs: -35, segmentMergeGapMs: 300, maxSegmentsPerMin: 6 },
      baselineRms: 1e-3,
      displayBaselineDb: 40,
      ringBuffer,
    });

    aggregator.onFrame(frame(0, -50));
    aggregator.onFrame(frame(100, -95));
    aggregator.onFrame(frame(200, -50));
    aggregator.onFrame(frame(300, -135));
    aggregator.onFrame(frame(400, -50));

    const slice = aggregator.flush();
    expect(slice).not.toBeNull();
    expect(slice?.frames).toBe(3);
    expect(slice?.raw.avgDbfs).toBeGreaterThan(-90);
  });

  it("Display dB 应始终限制在 20-100 范围内", () => {
    const ringBuffer = createNoiseRealtimeRingBuffer({
      retentionMs: 5 * 60 * 1000,
      capacity: 4096,
    });
    const aggregator = createNoiseSliceAggregator({
      sliceSec: 2,
      frameMs: 100,
      score: { scoreThresholdDbfs: -35, segmentMergeGapMs: 300, maxSegmentsPerMin: 6 },
      baselineRms: 1e-3,
      displayBaselineDb: 40,
      ringBuffer,
    });

    aggregator.onFrame(frame(0, -50));
    aggregator.onFrame(frame(100, -10));
    aggregator.onFrame(frame(200, -50));

    const points = ringBuffer.snapshot();
    for (const p of points) {
      expect(p.displayDb).toBeGreaterThanOrEqual(20);
      expect(p.displayDb).toBeLessThanOrEqual(100);
    }
  });
});
