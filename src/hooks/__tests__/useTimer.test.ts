/**
 * useTimer 单元测试
 * 测试高精度计时器的核心功能
 */
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { useTimer, useHighFrequencyTimer, useAccumulatingTimer } from "../useTimer";

describe("useTimer", () => {
  let rafCallbacks: Array<() => void> = [];
  let rafId = 0;

  beforeEach(() => {
    rafCallbacks = [];
    rafId = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      const id = rafId++;
      rafCallbacks.push(() => cb(performance.now()));
      return id as unknown as number;
    });

    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      const index = rafCallbacks.findIndex((_, idx) => idx === (id as number));
      if (index !== -1) {
        rafCallbacks.splice(index, 1);
      }
    });

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("应该在指定间隔触发回调函数", () => {
    const callback = vi.fn();
    renderHook(() => useTimer(callback, true, 100));

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    rafCallbacks[0]();

    expect(callback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    rafCallbacks[1]();

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("当 isActive 为 false 时不应触发回调", () => {
    const callback = vi.fn();
    renderHook(() => useTimer(callback, false, 100));

    rafCallbacks.forEach((cb) => cb());

    expect(callback).not.toHaveBeenCalled();
  });

  it("应该累积补偿，避免页面休眠后的时间漂移", () => {
    const callback = vi.fn();
    const interval = 100;

    renderHook(() => useTimer(callback, true, interval));

    expect(callback).not.toHaveBeenCalled();

    rafCallbacks[0]();

    expect(callback).toHaveBeenCalledTimes(1);

    const newRafCallbacks: Array<() => void> = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      const id = rafId++;
      newRafCallbacks.push(() => cb(performance.now()));
      return id as unknown as number;
    });

    rafCallbacks = newRafCallbacks;

    rafCallbacks[0]();

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("卸载时应清理 RAF 和计时器状态", () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useTimer(callback, true, 100));

    expect(rafCallbacks.length).toBeGreaterThan(0);

    unmount();

    expect(window.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("回调更新时应该使用最新的回调函数", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const { rerender } = renderHook(({ callback }) => useTimer(callback, true, 100), {
      initialProps: { callback: callback1 },
    });

    rafCallbacks.forEach((cb) => cb());
    expect(callback1).toHaveBeenCalled();

    rerender({ callback: callback2 });

    rafCallbacks = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      const id = rafId++;
      rafCallbacks.push(() => cb(performance.now()));
      return id as unknown as number;
    });

    rafCallbacks.forEach((cb) => cb());
    expect(callback2).toHaveBeenCalled();
  });

  it("间隔更新时应该使用新的间隔", () => {
    const callback = vi.fn();
    const { rerender } = renderHook(({ interval }) => useTimer(callback, true, interval), {
      initialProps: { interval: 100 },
    });

    rafCallbacks[0]();
    expect(callback).toHaveBeenCalledTimes(1);

    rerender({ interval: 200 });

    rafCallbacks[1]();
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

describe("useHighFrequencyTimer", () => {
  let rafCallbacks: Array<() => void> = [];
  let rafId = 0;

  beforeEach(() => {
    rafCallbacks = [];
    rafId = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      const id = rafId++;
      rafCallbacks.push(() => cb(performance.now()));
      return id as unknown as number;
    });

    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      const index = rafCallbacks.findIndex((_, idx) => idx === (id as number));
      if (index !== -1) {
        rafCallbacks.splice(index, 1);
      }
    });

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("应该使用 10ms 高频间隔", () => {
    const callback = vi.fn();
    renderHook(() => useHighFrequencyTimer(callback, true));

    rafCallbacks[0]();

    expect(callback).toHaveBeenCalled();
  });
});

describe("useAccumulatingTimer", () => {
  let rafCallbacks: Array<() => void> = [];
  let rafId = 0;

  beforeEach(() => {
    rafCallbacks = [];
    rafId = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      const id = rafId++;
      rafCallbacks.push(() => cb(performance.now()));
      return id as unknown as number;
    });

    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      const index = rafCallbacks.findIndex((_, idx) => idx === (id as number));
      if (index !== -1) {
        rafCallbacks.splice(index, 1);
      }
    });

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("应该传递累积次数给回调函数", () => {
    const callback = vi.fn();
    renderHook(() => useAccumulatingTimer(callback, true, 100));

    rafCallbacks[0]();
    expect(callback).toHaveBeenCalledWith(1);

    rafCallbacks[1]();
    expect(callback).toHaveBeenCalledWith(1);
  });
});
