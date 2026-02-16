import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  APP_SETTINGS_KEY,
  getAppSettings,
  updateTimeSyncSettings,
  updateStudySettings,
} from "../appSettings";

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

/** appSettings 单元测试（函数级注释：验证默认值合并、深合并与局部更新行为） */
describe("appSettings", () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage();
  });

  afterEach(() => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = originalLocalStorage;
  });

  it("getAppSettings 在无存储时返回默认配置", () => {
    const s = getAppSettings();
    expect(s.general.timeSync.provider).toBe("httpDate");
    expect(s.study.display.showTime).toBe(true);
    expect(Array.isArray(s.general.quote.channels)).toBe(true);
  });

  it("getAppSettings 能对 study.display 做深合并，避免缺字段", () => {
    localStorage.setItem(
      APP_SETTINGS_KEY,
      JSON.stringify({
        study: {
          display: { showQuote: false },
        },
      })
    );

    const s = getAppSettings();
    expect(s.study.display.showQuote).toBe(false);
    expect(s.study.display.showTime).toBe(true);
    expect(s.study.display.showDate).toBe(true);
  });

  it("getAppSettings 能对 general.weather 做合并并补齐默认字段", () => {
    localStorage.setItem(
      APP_SETTINGS_KEY,
      JSON.stringify({
        general: {
          weather: { autoRefreshIntervalMin: 60 },
        },
      })
    );

    const s = getAppSettings();
    expect(s.general.weather.autoRefreshIntervalMin).toBe(60);
    expect(s.general.weather.locationMode).toBe("auto");
    expect(s.general.weather.manualLocation.type).toBe("city");
  });

  it("getAppSettings 能兼容拆分版 alerts 字段，并合并到 minutelyPrecip", () => {
    localStorage.setItem(
      APP_SETTINGS_KEY,
      JSON.stringify({
        study: {
          alerts: { minutelyForecast: true, precipDuration: false },
        },
      })
    );

    const s = getAppSettings();
    expect(s.study.alerts.minutelyPrecip).toBe(true);
  });

  it("updateTimeSyncSettings 会深合并 timeSync，避免覆盖丢字段", () => {
    localStorage.setItem(
      APP_SETTINGS_KEY,
      JSON.stringify({
        general: {
          timeSync: { provider: "timeApi", timeApiUrl: "https://api.example/time" },
        },
      })
    );

    updateTimeSyncSettings({ enabled: true });

    const s = getAppSettings();
    expect(s.general.timeSync.enabled).toBe(true);
    expect(s.general.timeSync.provider).toBe("timeApi");
    expect(s.general.timeSync.timeApiUrl).toBe("https://api.example/time");
  });

  it("updateStudySettings 会深合并 display/style/alerts/background", () => {
    localStorage.setItem(
      APP_SETTINGS_KEY,
      JSON.stringify({
        study: {
          display: { showQuote: false },
          style: { digitOpacity: 0.5 },
          alerts: { weatherAlert: true },
          background: { type: "color", color: "#000000" },
        },
      })
    );

    updateStudySettings({
      display: { showCountdown: false },
      alerts: { minutelyPrecip: true },
      background: { colorAlpha: 0.8 },
    });

    const s = getAppSettings();
    expect(s.study.display.showQuote).toBe(false);
    expect(s.study.display.showCountdown).toBe(false);
    expect(s.study.display.showTime).toBe(true);
    expect(s.study.style.digitOpacity).toBe(0.5);
    expect(s.study.alerts.weatherAlert).toBe(true);
    expect(s.study.alerts.minutelyPrecip).toBe(true);
    expect(s.study.background.type).toBe("color");
    expect(s.study.background.color).toBe("#000000");
    expect(s.study.background.colorAlpha).toBe(0.8);
  });
});
