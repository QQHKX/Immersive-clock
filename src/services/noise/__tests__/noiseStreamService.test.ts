import { beforeEach, describe, expect, it, vi } from "vitest";

describe("noiseStreamService", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("多个订阅者应共享一次启动，并在最后一个取消后停止", async () => {
    vi.useFakeTimers();
    const startNoiseCapture = vi.fn().mockResolvedValue({ analyser: {} });
    const stopNoiseCapture = vi.fn().mockResolvedValue(undefined);

    vi.doMock("../noiseCapture", () => ({
      startNoiseCapture,
      stopNoiseCapture,
    }));

    const start = vi.fn();
    const stop = vi.fn();
    vi.doMock("../noiseFrameProcessor", () => ({
      createNoiseFrameProcessor: vi.fn(() => ({
        start,
        stop,
        isRunning: () => true,
      })),
    }));

    vi.doMock("../noiseSliceAggregator", () => ({
      createNoiseSliceAggregator: vi.fn(() => ({
        onFrame: vi.fn(() => null),
        flush: vi.fn(() => null),
        reset: vi.fn(),
        setDisplayMapping: vi.fn(),
        setScoreOptions: vi.fn(),
        setSliceSec: vi.fn(),
      })),
    }));

    vi.doMock("../../../utils/noiseSliceService", () => ({
      writeNoiseSlice: vi.fn(),
    }));

    vi.doMock("../../../utils/settingsEvents", () => ({
      SETTINGS_EVENTS: {
        NoiseControlSettingsUpdated: "noiseControlSettingsUpdated",
        NoiseBaselineUpdated: "noiseBaselineUpdated",
      },
      subscribeSettingsEvent: vi.fn(() => () => {}),
    }));

    const { subscribeNoiseStream } = await import("../noiseStreamService");

    const unsub1 = subscribeNoiseStream(() => {});
    const unsub2 = subscribeNoiseStream(() => {});

    await Promise.resolve();
    await Promise.resolve();
    expect(startNoiseCapture).toHaveBeenCalledTimes(1);

    unsub1();
    await vi.advanceTimersByTimeAsync(1000);
    expect(stopNoiseCapture).toHaveBeenCalledTimes(0);

    unsub2();
    await vi.advanceTimersByTimeAsync(1000);
    expect(stopNoiseCapture).toHaveBeenCalledTimes(1);
  });

  it("restartNoiseStream 在仍有订阅者时应重启采集", async () => {
    const startNoiseCapture = vi.fn().mockResolvedValue({ analyser: {} });
    const stopNoiseCapture = vi.fn().mockResolvedValue(undefined);

    vi.doMock("../noiseCapture", () => ({
      startNoiseCapture,
      stopNoiseCapture,
    }));

    vi.doMock("../noiseFrameProcessor", () => ({
      createNoiseFrameProcessor: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: () => true,
      })),
    }));

    vi.doMock("../noiseSliceAggregator", () => ({
      createNoiseSliceAggregator: vi.fn(() => ({
        onFrame: vi.fn(() => null),
        flush: vi.fn(() => null),
        reset: vi.fn(),
        setDisplayMapping: vi.fn(),
        setScoreOptions: vi.fn(),
        setSliceSec: vi.fn(),
      })),
    }));

    vi.doMock("../../../utils/noiseSliceService", () => ({
      writeNoiseSlice: vi.fn(),
    }));

    vi.doMock("../../../utils/settingsEvents", () => ({
      SETTINGS_EVENTS: {
        NoiseControlSettingsUpdated: "noiseControlSettingsUpdated",
        NoiseBaselineUpdated: "noiseBaselineUpdated",
      },
      subscribeSettingsEvent: vi.fn(() => () => {}),
    }));

    const { subscribeNoiseStream, restartNoiseStream } = await import("../noiseStreamService");

    const unsub = subscribeNoiseStream(() => {});
    await new Promise((r) => setTimeout(r, 0));
    expect(startNoiseCapture).toHaveBeenCalledTimes(1);

    await restartNoiseStream();
    await new Promise((r) => setTimeout(r, 0));
    expect(stopNoiseCapture).toHaveBeenCalledTimes(1);
    expect(startNoiseCapture).toHaveBeenCalledTimes(2);

    unsub();
  });
});
