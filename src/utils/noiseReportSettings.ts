/**
 * 噪音报告设置存储工具
 * 管理用户的噪音报告相关偏好设置
 */
import { getAppSettings, updateNoiseSettings } from "./appSettings";
import { logger } from "./logger";
import { broadcastSettingsEvent, SETTINGS_EVENTS } from "./settingsEvents";

/**
 * 噪音报告设置接口
 */
export interface NoiseReportSettings {
  autoPopup: boolean; // 是否自动弹出报告
}

/**
 * 默认设置
 */
const DEFAULT_SETTINGS: NoiseReportSettings = {
  autoPopup: true, // 默认开启自动弹出
};

/**
 * 获取噪音报告设置
 * @returns 噪音报告设置对象
 */
export function getNoiseReportSettings(): NoiseReportSettings {
  const autoPopup = getAppSettings().noiseControl.reportAutoPopup;
  return {
    autoPopup: autoPopup ?? DEFAULT_SETTINGS.autoPopup,
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

/**
 * 重置噪音报告设置为默认值
 */
export function resetNoiseReportSettings(): void {
  try {
    updateNoiseSettings({ reportAutoPopup: DEFAULT_SETTINGS.autoPopup });
    broadcastSettingsEvent(SETTINGS_EVENTS.NoiseReportSettingsUpdated, {
      settings: getNoiseReportSettings(),
    });
  } catch (error) {
    logger.error("重置噪音报告设置失败:", error);
  }
}
