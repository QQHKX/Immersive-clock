/**
 * 噪音报告设置存储工具
 * 管理用户的噪音报告相关偏好设置
 */
import {
  DEFAULT_NOISE_REPORT_RETENTION_DAYS,
  MAX_NOISE_REPORT_RETENTION_DAYS_FALLBACK,
  MIN_NOISE_REPORT_RETENTION_DAYS,
} from "../constants/noiseReport";

import { getAppSettings, updateNoiseSettings } from "./appSettings";
import { logger } from "./logger";
import { readNoiseSlices } from "./noiseSliceService";
import { broadcastSettingsEvent, SETTINGS_EVENTS } from "./settingsEvents";

/**
 * 噪音报告设置接口
 */
export interface NoiseReportSettings {
  autoPopup: boolean; // 是否自动弹出报告
  retentionDays: number; // 历史数据保存天数
}

/**
 * 默认设置
 */
const DEFAULT_SETTINGS: NoiseReportSettings = {
  autoPopup: true, // 默认开启自动弹出
  retentionDays: DEFAULT_NOISE_REPORT_RETENTION_DAYS,
};

function normalizeRetentionDays(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_SETTINGS.retentionDays;
  const rounded = Math.round(value);
  if (rounded < MIN_NOISE_REPORT_RETENTION_DAYS) return MIN_NOISE_REPORT_RETENTION_DAYS;
  return rounded;
}

/**
 * 获取噪音报告设置
 * @returns 噪音报告设置对象
 */
export function getNoiseReportSettings(): NoiseReportSettings {
  const noiseControl = getAppSettings().noiseControl;
  const autoPopup = noiseControl.reportAutoPopup;
  const retentionDays = normalizeRetentionDays(noiseControl.reportRetentionDays);
  return {
    autoPopup: autoPopup ?? DEFAULT_SETTINGS.autoPopup,
    retentionDays,
  };
}

/**
 * 保存噪音报告设置
 * @param settings 要保存的设置
 */
export function saveNoiseReportSettings(settings: Partial<NoiseReportSettings>): void {
  try {
    const currentSettings = getNoiseReportSettings();
    const newSettings = { ...currentSettings, ...settings };

    // 保存设置
    if (settings.autoPopup !== undefined) {
      updateNoiseSettings({ reportAutoPopup: settings.autoPopup });
    }
    if (settings.retentionDays !== undefined) {
      updateNoiseSettings({ reportRetentionDays: normalizeRetentionDays(settings.retentionDays) });
    }
    // 广播：噪音报告设置更新
    broadcastSettingsEvent(SETTINGS_EVENTS.NoiseReportSettingsUpdated, { settings: newSettings });
  } catch (error) {
    logger.error("保存噪音报告设置失败:", error);
  }
}

/**
 * 获取是否自动弹出报告的设置
 * @returns 是否自动弹出报告
 */
export function getAutoPopupSetting(): boolean {
  return getNoiseReportSettings().autoPopup;
}

/**
 * 设置是否自动弹出报告
 * @param autoPopup 是否自动弹出报告
 */
export function setAutoPopupSetting(autoPopup: boolean): void {
  saveNoiseReportSettings({ autoPopup });
}

export function getRetentionDaysSetting(): number {
  return getNoiseReportSettings().retentionDays;
}

export function setRetentionDaysSetting(retentionDays: number): void {
  saveNoiseReportSettings({ retentionDays });
}

export async function estimateMaxRetentionDaysByQuota(): Promise<number | null> {
  try {
    if (!("storage" in navigator) || typeof navigator.storage.estimate !== "function") return null;
    const estimate = await navigator.storage.estimate();
    const quota = typeof estimate.quota === "number" ? estimate.quota : undefined;
    if (!quota || quota <= 0) return null;

    const maxBytes = quota * 0.9;
    const slices = readNoiseSlices();
    const dayMs = 24 * 60 * 60 * 1000;

    let bytesPerDay = 512 * 1024;
    if (slices.length > 0) {
      let minStart = Infinity;
      let maxEnd = -Infinity;
      for (const s of slices) {
        if (s.start < minStart) minStart = s.start;
        if (s.end > maxEnd) maxEnd = s.end;
      }
      const spanDays = Math.max(1, (maxEnd - minStart) / dayMs);
      const raw = localStorage.getItem("noise-slices");
      const usedBytes = (raw ? raw.length : 0) * 2;
      if (usedBytes > 0) {
        bytesPerDay = usedBytes / spanDays;
      }
    }

    const maxDays = Math.floor(maxBytes / Math.max(1, bytesPerDay));
    if (!Number.isFinite(maxDays) || maxDays < MIN_NOISE_REPORT_RETENTION_DAYS) {
      return MIN_NOISE_REPORT_RETENTION_DAYS;
    }
    return Math.min(MAX_NOISE_REPORT_RETENTION_DAYS_FALLBACK, maxDays);
  } catch {
    return null;
  }
}

/**
 * 重置噪音报告设置为默认值
 */
export function resetNoiseReportSettings(): void {
  try {
    updateNoiseSettings({
      reportAutoPopup: DEFAULT_SETTINGS.autoPopup,
      reportRetentionDays: DEFAULT_SETTINGS.retentionDays,
    });
    broadcastSettingsEvent(SETTINGS_EVENTS.NoiseReportSettingsUpdated, {
      settings: getNoiseReportSettings(),
    });
  } catch (error) {
    logger.error("重置噪音报告设置失败:", error);
  }
}
