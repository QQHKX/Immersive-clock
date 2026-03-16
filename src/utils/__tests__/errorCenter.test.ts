import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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

describe("errorCenter", () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as unknown as { localStorage: Storage }).localStorage = originalLocalStorage;
  });

  it("pushErrorCenterRecord 会在时间窗内合并重复记录", async () => {
    vi.resetModules();
    const mod = await import("../errorCenter");
    mod.setErrorCenterMode("persist");
    mod.clearErrorCenter();

    vi.setSystemTime(1000);
    mod.pushErrorCenterRecord({ level: "error", source: "test", title: "T", message: "M" });
    vi.setSystemTime(2000);
    mod.pushErrorCenterRecord({ level: "error", source: "test", title: "T", message: "M" });

    const list = mod.getErrorCenterRecords();
    expect(list.length).toBe(1);
    expect(list[0].count).toBe(2);
  });

  it("ErrorCenter 会裁剪到最大记录数", async () => {
    vi.resetModules();
    const mod = await import("../errorCenter");
    mod.setErrorCenterMode("persist");
    mod.clearErrorCenter();

    for (let i = 0; i < 260; i++) {
      vi.setSystemTime(1000 + i * 10);
      mod.pushErrorCenterRecord({
        level: "info",
        source: "test",
        title: `T${i}`,
        message: `M${i}`,
      });
    }

    expect(mod.getErrorCenterRecords().length).toBeLessThanOrEqual(200);
  });

  it("initErrorCenterGlobalCapture 会从 localStorage 回放记录", async () => {
    vi.resetModules();
    const first = await import("../errorCenter");
    first.setErrorCenterMode("persist");
    first.pushErrorCenterRecord({ level: "error", source: "test", title: "T", message: "M" });

    vi.resetModules();
    const second = await import("../errorCenter");
    second.setErrorCenterMode("persist");
    second.initErrorCenterGlobalCapture();
    expect(second.getErrorCenterRecords().length).toBe(1);
    expect(second.getErrorCenterRecords()[0].title).toBe("T");
  });
});
