/**
 * 噪音报告设置存储工具
 * 管理用户的噪音报告相关偏好设置
 */
import { broadcastSettingsEvent, SETTINGS_EVENTS } from './settingsEvents';

// localStorage 键名
const AUTO_POPUP_KEY = 'noise-report-auto-popup';

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
  try {
    const autoPopup = localStorage.getItem(AUTO_POPUP_KEY);
    return {
      autoPopup: autoPopup !== null ? autoPopup === 'true' : DEFAULT_SETTINGS.autoPopup,
    };
  } catch (error) {
    console.warn('读取噪音报告设置失败:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * 保存噪音报告设置
 * @param settings 要保存的设置
 */
export function saveNoiseReportSettings(settings: Partial<NoiseReportSettings>): void {
  try {
    const currentSettings = getNoiseReportSettings();
    const newSettings = { ...currentSettings, ...settings };
    
    // 保存各个设置项
    if (settings.autoPopup !== undefined) {
      localStorage.setItem(AUTO_POPUP_KEY, settings.autoPopup.toString());
    }
    // 广播：噪音报告设置更新
    broadcastSettingsEvent(SETTINGS_EVENTS.NoiseReportSettingsUpdated, { settings: newSettings });
  } catch (error) {
    console.error('保存噪音报告设置失败:', error);
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
    localStorage.removeItem(AUTO_POPUP_KEY);
    broadcastSettingsEvent(SETTINGS_EVENTS.NoiseReportSettingsUpdated, { settings: getNoiseReportSettings() });
  } catch (error) {
    console.error('重置噪音报告设置失败:', error);
  }
}