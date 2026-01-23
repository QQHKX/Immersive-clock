import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  clearAnnouncementHidePreference,
  getAnnouncementHideInfo,
  setDontShowForWeek,
  shouldShowAnnouncement,
} from "../announcementStorage";

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

/** announcementStorage 单元测试（函数级注释：验证“一周内不再显示”的 AppSettings 持久化与展示判定） */
describe("announcementStorage", () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage();
  });

  afterEach(() => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = originalLocalStorage;
  });

  it("默认应显示公告（无隐藏设置）", () => {
    expect(shouldShowAnnouncement()).toBe(true);
  });

  it("设置一周内不显示后，在隐藏期内不应显示", () => {
    const baseNow = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => baseNow);
    setDontShowForWeek();

    vi.spyOn(Date, "now").mockImplementation(() => baseNow + 100);
    expect(shouldShowAnnouncement()).toBe(false);
  });

  it("隐藏期结束后应重新显示", () => {
    const baseNow = 10_000;
    vi.spyOn(Date, "now").mockImplementation(() => baseNow);
    setDontShowForWeek();

    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    vi.spyOn(Date, "now").mockImplementation(() => baseNow + oneWeekMs + 1);
    expect(shouldShowAnnouncement()).toBe(true);
  });

  it("版本号不一致时应强制显示（即使仍在隐藏期）", () => {
    const future = 9_999_999;
    localStorage.setItem(
      "AppSettings",
      JSON.stringify({
        general: {
          announcement: { hideUntil: future, version: "old-version" },
        },
      })
    );

    vi.spyOn(Date, "now").mockImplementation(() => 1000);
    expect(shouldShowAnnouncement()).toBe(true);
  });

  it("getAnnouncementHideInfo 能返回隐藏状态与剩余时间", () => {
    const baseNow = 10_000;
    vi.spyOn(Date, "now").mockImplementation(() => baseNow);
    setDontShowForWeek();

    vi.spyOn(Date, "now").mockImplementation(() => baseNow + 1234);
    const info = getAnnouncementHideInfo();
    expect(info.isHidden).toBe(true);
    expect(info.hideUntil).not.toBeNull();
    expect(typeof info.remainingTime).toBe("number");
    expect((info.remainingTime || 0) > 0).toBe(true);
  });

  it("clearAnnouncementHidePreference 会清空隐藏设置", () => {
    vi.spyOn(Date, "now").mockImplementation(() => 1000);
    setDontShowForWeek();
    expect(getAnnouncementHideInfo().isHidden).toBe(true);

    clearAnnouncementHidePreference();
    expect(getAnnouncementHideInfo().isHidden).toBe(false);
  });
});
