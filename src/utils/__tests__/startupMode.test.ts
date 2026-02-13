import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_SETTINGS_KEY } from "../appSettings";
import { getStartupModeFromSettings, resolveStartupMode } from "../startupMode";

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

/** startupMode 单元测试（函数级注释：覆盖非法值兜底与从 AppSettings 读取的行为） */
describe("startupMode", () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage();
  });

  afterEach(() => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = originalLocalStorage;
  });

  it("resolveStartupMode 对合法值原样返回", () => {
    expect(resolveStartupMode("clock")).toBe("clock");
    expect(resolveStartupMode("countdown")).toBe("countdown");
    expect(resolveStartupMode("stopwatch")).toBe("stopwatch");
    expect(resolveStartupMode("study")).toBe("study");
  });

  it("resolveStartupMode 对非法值回退到 clock", () => {
    expect(resolveStartupMode(undefined)).toBe("clock");
    expect(resolveStartupMode(null)).toBe("clock");
    expect(resolveStartupMode("unknown")).toBe("clock");
    expect(resolveStartupMode(123)).toBe("clock");
    expect(resolveStartupMode({})).toBe("clock");
  });

  it("getStartupModeFromSettings 从 AppSettings 读取并兜底", () => {
    localStorage.setItem(
      APP_SETTINGS_KEY,
      JSON.stringify({
        general: { startup: { initialMode: "study" } },
      })
    );
    expect(getStartupModeFromSettings()).toBe("study");

    localStorage.setItem(
      APP_SETTINGS_KEY,
      JSON.stringify({
        general: { startup: { initialMode: "invalid" } },
      })
    );
    expect(getStartupModeFromSettings()).toBe("clock");
  });
});
