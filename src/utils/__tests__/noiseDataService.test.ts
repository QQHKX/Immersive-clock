import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  type NoiseSample,
  NOISE_SAMPLE_STORAGE_KEY,
  readNoiseSamples,
  writeNoiseSample,
  clearNoiseSamples,
  subscribeNoiseSamplesUpdated,
} from "../noiseDataService";

type NoiseEventListener = (event: { type: string }) => void;

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

class FakeCustomEvent<T = unknown> {
  type: string;
  detail: T | undefined;

  constructor(type: string, init?: { detail?: T }) {
    this.type = type;
    this.detail = init?.detail;
  }
}

interface GlobalWithNoiseEnv {
  localStorage: Storage;
  window: FakeWindow;
  CustomEvent: typeof FakeCustomEvent;
}

class FakeWindow {
  private listeners = new Map<string, NoiseEventListener[]>();

  dispatchEvent(event: { type: string }): boolean {
    const handlers = this.listeners.get(event.type) || [];
    handlers.forEach((handler) => handler(event));
    return true;
  }

  addEventListener(type: string, listener: NoiseEventListener): void {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, listener: NoiseEventListener): void {
    const list = this.listeners.get(type) || [];
    this.listeners.set(
      type,
      list.filter((fn) => fn !== listener)
    );
  }
}

/** 噪音数据服务单元与集成测试（函数级注释：验证存储与事件通知） */
describe("noiseDataService", () => {
  const RETENTION_MS = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    const g = globalThis as unknown as GlobalWithNoiseEnv;
    g.localStorage = new MemoryStorage();
    g.window = new FakeWindow();
    g.CustomEvent = FakeCustomEvent;
    vi.restoreAllMocks();
  });

  it("readNoiseSamples 返回空数组（无数据或损坏数据）", () => {
    expect(readNoiseSamples()).toEqual([]);

    localStorage.setItem(NOISE_SAMPLE_STORAGE_KEY, "not-json");
    expect(readNoiseSamples()).toEqual([]);
  });

  it("readNoiseSamples 返回已保存的噪音样本列表", () => {
    const list: NoiseSample[] = [
      { t: 1, v: 30, s: "quiet" },
      { t: 2, v: 60, s: "noisy" },
    ];
    localStorage.setItem(NOISE_SAMPLE_STORAGE_KEY, JSON.stringify(list));

    const result = readNoiseSamples();
    expect(result).toEqual(list);
  });

  it("writeNoiseSample 追加样本并按保留窗口裁剪旧样本", () => {
    const oldSample: NoiseSample = {
      t: 0,
      v: 20,
      s: "quiet",
    };
    const now = RETENTION_MS + 10;
    const newSample: NoiseSample = {
      t: now,
      v: 55,
      s: "noisy",
    };
    localStorage.setItem(NOISE_SAMPLE_STORAGE_KEY, JSON.stringify([oldSample]));

    const eventSpy = vi.spyOn(window, "dispatchEvent");
    const trimmed = writeNoiseSample(newSample);

    expect(trimmed).toEqual([newSample]);
    expect(JSON.parse(localStorage.getItem(NOISE_SAMPLE_STORAGE_KEY) || "[]")).toEqual([newSample]);
    expect(eventSpy).toHaveBeenCalledTimes(1);
    const evt = eventSpy.mock.calls[0][0];
    expect(evt).toBeInstanceOf(CustomEvent);
  });

  it("writeNoiseSample 写入失败时返回当前读取结果", () => {
    const sample: NoiseSample = { t: 1, v: 40, s: "quiet" };
    const error = new Error("set error");
    const setSpy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw error;
    });

    const result = writeNoiseSample(sample);
    expect(Array.isArray(result)).toBe(true);
    expect(setSpy).toHaveBeenCalled();
  });

  it("clearNoiseSamples 移除存储并派发更新事件", () => {
    localStorage.setItem(
      NOISE_SAMPLE_STORAGE_KEY,
      JSON.stringify([{ t: 1, v: 20, s: "quiet" } satisfies NoiseSample])
    );

    const eventSpy = vi.spyOn(window, "dispatchEvent");
    clearNoiseSamples();

    expect(localStorage.getItem(NOISE_SAMPLE_STORAGE_KEY)).toBeNull();
    expect(eventSpy).toHaveBeenCalledTimes(1);
  });

  it("subscribeNoiseSamplesUpdated 订阅与取消订阅事件", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeNoiseSamplesUpdated(handler);

    window.dispatchEvent(new CustomEvent("noise-samples-updated"));
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    window.dispatchEvent(new CustomEvent("noise-samples-updated"));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
