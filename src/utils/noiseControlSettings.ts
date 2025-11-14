/**
 * 噪音控制设置存储工具
 * 管理用户的最大允许噪音级别与手动基准噪音显示值
 */
import { logger } from "./logger";
import { broadcastSettingsEvent, SETTINGS_EVENTS } from "./settingsEvents";

// localStorage 键名
const NOISE_MAX_LEVEL_KEY = "noise-control-max-level-db";
const NOISE_BASELINE_DB_KEY = "noise-control-baseline-db";
const NOISE_SHOW_REALTIME_DB_KEY = "noise-control-show-realtime-db";
// 新增：噪音平均时间窗（秒）
const NOISE_AVG_WINDOW_SEC_KEY = "noise-control-avg-window-sec";

export interface NoiseControlSettings {
  maxLevelDb: number; // 最大允许噪音级别（阈值）
  baselineDb: number; // 手动基准显示分贝
  showRealtimeDb: boolean; // 是否显示实时分贝副文本
  avgWindowSec: number; // 噪音平均时间窗（秒）
}

const DEFAULT_SETTINGS: NoiseControlSettings = {
  maxLevelDb: 55,
  baselineDb: 40,
  showRealtimeDb: true,
  avgWindowSec: 1,
};

export function getNoiseControlSettings(): NoiseControlSettings {
  try {
    const maxLevel = localStorage.getItem(NOISE_MAX_LEVEL_KEY);
    const baselineDb = localStorage.getItem(NOISE_BASELINE_DB_KEY);
    const showRealtimeDb = localStorage.getItem(NOISE_SHOW_REALTIME_DB_KEY);
    const avgWindowSecStr = localStorage.getItem(NOISE_AVG_WINDOW_SEC_KEY);
    return {
      maxLevelDb: maxLevel !== null ? parseFloat(maxLevel) : DEFAULT_SETTINGS.maxLevelDb,
      baselineDb: baselineDb !== null ? parseFloat(baselineDb) : DEFAULT_SETTINGS.baselineDb,
      showRealtimeDb:
        showRealtimeDb !== null ? showRealtimeDb === "true" : DEFAULT_SETTINGS.showRealtimeDb,
      avgWindowSec:
        avgWindowSecStr !== null
          ? Math.max(0.2, parseFloat(avgWindowSecStr))
          : DEFAULT_SETTINGS.avgWindowSec,
    };
  } catch (error) {
    logger.warn("读取噪音控制设置失败:", error);
    return DEFAULT_SETTINGS;
  }
}

export function saveNoiseControlSettings(settings: Partial<NoiseControlSettings>): void {
  try {
    const current = getNoiseControlSettings();
    const next = { ...current, ...settings };
    if (settings.maxLevelDb !== undefined) {
      localStorage.setItem(NOISE_MAX_LEVEL_KEY, next.maxLevelDb.toString());
    }
    if (settings.baselineDb !== undefined) {
      localStorage.setItem(NOISE_BASELINE_DB_KEY, next.baselineDb.toString());
    }
    if (settings.showRealtimeDb !== undefined) {
      localStorage.setItem(NOISE_SHOW_REALTIME_DB_KEY, next.showRealtimeDb ? "true" : "false");
    }
    if (settings.avgWindowSec !== undefined) {
      localStorage.setItem(NOISE_AVG_WINDOW_SEC_KEY, next.avgWindowSec.toString());
    }
    // 广播：噪音控制设置更新
    broadcastSettingsEvent(SETTINGS_EVENTS.NoiseControlSettingsUpdated, { settings: next });
    if (settings.baselineDb !== undefined) {
      broadcastSettingsEvent(SETTINGS_EVENTS.NoiseBaselineUpdated, { baselineDb: next.baselineDb });
    }
  } catch (error) {
    logger.error("保存噪音控制设置失败:", error);
  }
}

export function getMaxNoiseLevel(): number {
  return getNoiseControlSettings().maxLevelDb;
}

export function setMaxNoiseLevel(db: number): void {
  saveNoiseControlSettings({ maxLevelDb: db });
}

export function getManualBaselineDb(): number {
  return getNoiseControlSettings().baselineDb;
}

export function setManualBaselineDb(db: number): void {
  saveNoiseControlSettings({ baselineDb: db });
}

export function getShowRealtimeDb(): boolean {
  return getNoiseControlSettings().showRealtimeDb;
}

export function setShowRealtimeDb(show: boolean): void {
  saveNoiseControlSettings({ showRealtimeDb: show });
}

export function getAvgWindowSec(): number {
  return getNoiseControlSettings().avgWindowSec;
}

export function setAvgWindowSec(sec: number): void {
  saveNoiseControlSettings({ avgWindowSec: sec });
}

export function resetNoiseControlSettings(): void {
  try {
    localStorage.removeItem(NOISE_MAX_LEVEL_KEY);
    localStorage.removeItem(NOISE_BASELINE_DB_KEY);
    localStorage.removeItem(NOISE_SHOW_REALTIME_DB_KEY);
    localStorage.removeItem(NOISE_AVG_WINDOW_SEC_KEY);
    // 广播：重置后也应通知订阅者使用默认值
    broadcastSettingsEvent(SETTINGS_EVENTS.NoiseControlSettingsUpdated, {
      settings: getNoiseControlSettings(),
    });
  } catch (error) {
    logger.error("重置噪音控制设置失败:", error);
  }
}
