/**
 * useTimer 单元测试
 * 测试高精度计时器的核心功能
 */
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { useTimer, useHighFrequencyTimer, useAccumulatingTimer } from "../useTimer";

function ensureRafApis() {
  const w = window as Window & typeof globalThis;
  const raf = (cb: FrameRequestCallback) => w.setTimeout(() => cb(Date.now()), 16);
  const caf = (id: number) => w.clearTimeout(id);
  if (typeof w.requestAnimationFrame !== "function") {
    Object.defineProperty(w, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: raf,
    });
  }
  if (typeof w.cancelAnimationFrame !== "function") {
    Object.defineProperty(w, "cancelAnimationFrame", {
      configurable: true,
      writable: true,
      value: caf,
    });
  }
  if (typeof globalThis.requestAnimationFrame !== "function") {
    Object.defineProperty(globalThis, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: raf,
    });
  }
  if (typeof globalThis.cancelAnimationFrame !== "function") {
    Object.defineProperty(globalThis, "cancelAnimationFrame", {
      configurable: true,
      writable: true,
      value: caf,
    });
  }
}

describe("useTimer", () => {
  let rafCallbacks: Map<number, () => void>;
  let rafId = 0;
  let now = 0;

  /**
   * 运行当前队列里“最早注册”的一次 requestAnimationFrame 回调
   */
  const runNextRaf = () => {
    const entries = Array.from(rafCallbacks.entries());
    expect(entries.length).toBeGreaterThan(0);
    const [id, fn] = entries[0];
    rafCallbacks.delete(id);
    fn();
  };

  beforeEach(() => {
    ensureRafApis();
    rafCallbacks = new Map();
    rafId = 1;
    now = 1;
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      const id = rafId++;
      rafCallbacks.set(id, () => cb(now));
      return id;
    });

    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
      rafCallbacks.delete(id as number);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("应该在指定间隔触发回调函数", () => {
    const callback = vi.fn();
    renderHook(() => useTimer(callback, true, 100));

    expect(callback).not.toHaveBeenCalled();

    runNextRaf();

    now += 100;
    runNextRaf();

    expect(callback).toHaveBeenCalledTimes(1);

    now += 100;
    runNextRaf();

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("当 isActive 为 false 时不应触发回调", () => {
    const callback = vi.fn();
    renderHook(() => useTimer(callback, false, 100));

    expect(rafCallbacks.size).toBe(0);
    expect(callback).not.toHaveBeenCalled();
  });

  it("应该累积补偿，避免页面休眠后的时间漂移", () => {
    const callback = vi.fn();
    const interval = 100;

    renderHook(() => useTimer(callback, true, interval));

    expect(callback).not.toHaveBeenCalled();

    runNextRaf();

    now += 250;
    runNextRaf();

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("卸载时应清理 RAF 和计时器状态", () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useTimer(callback, true, 100));

    expect(rafCallbacks.size).toBeGreaterThan(0);

    unmount();

    expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("回调更新时应该使用最新的回调函数", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const { rerender } = renderHook(
      ({ callback }: { callback: () => void }) => useTimer(callback, true, 100),
      {
        initialProps: { callback: callback1 },
      }
    );

    runNextRaf();
    now += 100;
    runNextRaf();
    expect(callback1).toHaveBeenCalledTimes(1);

    rerender({ callback: callback2 });

    now += 100;
    runNextRaf();
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it("间隔更新时应该使用新的间隔", () => {
    const callback = vi.fn();
    const { rerender } = renderHook(
      ({ interval }: { interval: number }) => useTimer(callback, true, interval),
      {
        initialProps: { interval: 100 },
      }
    );

    runNextRaf();
    now += 100;
    runNextRaf();
    expect(callback).toHaveBeenCalledTimes(1);

    rerender({ interval: 200 });

    now += 200;
    runNextRaf();
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

describe("useHighFrequencyTimer", () => {
  let rafCallbacks: Map<number, () => void>;
  let rafId = 0;
  let now = 0;

  /**
   * 运行当前队列里“最早注册”的一次 requestAnimationFrame 回调
   */
  const runNextRaf = () => {
    const entries = Array.from(rafCallbacks.entries());
    expect(entries.length).toBeGreaterThan(0);
    const [id, fn] = entries[0];
    rafCallbacks.delete(id);
    fn();
  };

  beforeEach(() => {
    ensureRafApis();
    rafCallbacks = new Map();
    rafId = 1;
    now = 1;
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      const id = rafId++;
      rafCallbacks.set(id, () => cb(now));
      return id;
    });

    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
      rafCallbacks.delete(id as number);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("应该使用 10ms 高频间隔", () => {
    const callback = vi.fn();
    renderHook(() => useHighFrequencyTimer(callback, true));

    runNextRaf();
    now += 10;
    runNextRaf();
    expect(callback).toHaveBeenCalled();
  });
});

describe("useAccumulatingTimer", () => {
  let rafCallbacks: Map<number, () => void>;
  let rafId = 0;
  let now = 0;

  /**
   * 运行当前队列里“最早注册”的一次 requestAnimationFrame 回调
   */
  const runNextRaf = () => {
    const entries = Array.from(rafCallbacks.entries());
    expect(entries.length).toBeGreaterThan(0);
    const [id, fn] = entries[0];
    rafCallbacks.delete(id);
    fn();
  };

  beforeEach(() => {
    ensureRafApis();
    rafCallbacks = new Map();
    rafId = 1;
    now = 1;
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      const id = rafId++;
      rafCallbacks.set(id, () => cb(now));
      return id;
    });

    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
      rafCallbacks.delete(id as number);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("应该传递累积次数给回调函数", () => {
    const callback = vi.fn();
    renderHook(() => useAccumulatingTimer(callback, true, 100));

    runNextRaf();
    now += 100;
    runNextRaf();
    expect(callback).toHaveBeenCalledWith(1);

    now += 100;
    runNextRaf();
    expect(callback).toHaveBeenCalledWith(1);
  });
});
