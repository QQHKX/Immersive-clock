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
    expect(slice?.frames).toBeGreaterThanOrEqual(frames.length);

    const points = ringBuffer.snapshot();
    expect(points.length).toBeGreaterThan(0);
  });
});
