import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { initializeStorage } from "../storageInitializer";

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

/** storageInitializer 单元测试（函数级注释：验证 legacy 键清理不会误保留） */
describe("storageInitializer - legacy cleanup", () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage();
  });

  afterEach(() => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = originalLocalStorage;
  });

  it("initializeStorage 会清理已知 legacy 键", () => {
    localStorage.setItem("AppSettings", JSON.stringify({ version: 1, modifiedAt: 1 }));
    localStorage.setItem("quote-auto-refresh-interval", "123");
    localStorage.setItem("weather.city", "Shanghai");
    localStorage.setItem("noise-control-max-level-db", "55");

    initializeStorage();

    expect(localStorage.getItem("quote-auto-refresh-interval")).toBeNull();
    expect(localStorage.getItem("weather.city")).toBeNull();
    expect(localStorage.getItem("noise-control-max-level-db")).toBeNull();
    expect(localStorage.getItem("AppSettings")).not.toBeNull();
  });
});
