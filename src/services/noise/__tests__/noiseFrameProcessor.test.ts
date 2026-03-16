import { describe, expect, it } from "vitest";

import { createNoiseFrameProcessor } from "../noiseFrameProcessor";

describe("noiseFrameProcessor", () => {
  it("DBFS 输出应限制在 -100 到 0 范围内", async () => {
    const frames: Array<{ rms: number; dbfs: number }> = [];
    const analyser = {
      fftSize: 2048,
      getFloatTimeDomainData: (buffer: Float32Array) => {
        buffer.fill(0);
      },
      smoothingTimeConstant: 0,
    } as unknown as AnalyserNode;

    const processor = createNoiseFrameProcessor({
      analyser,
      frameMs: 50,
      onFrame: (frame) => {
        frames.push({ rms: frame.rms, dbfs: frame.dbfs });
      },
    });

    processor.start();
    await new Promise((r) => setTimeout(r, 100));
    processor.stop();

    for (const f of frames) {
      expect(f.dbfs).toBeGreaterThanOrEqual(-100);
      expect(f.dbfs).toBeLessThanOrEqual(0);
    }
  });
});
