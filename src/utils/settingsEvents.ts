/**
 * 设置事件常量与工具方法
 * 为各组件提供统一的事件名称、广播与订阅接口
 */
import { logger } from "./logger";

// 统一的设置事件常量
export const SETTINGS_EVENTS = {
  SettingsSaved: "settingsSaved",
  SettingsPanelClosed: "settingsPanelClosed",
  NoiseControlSettingsUpdated: "noiseControlSettingsUpdated",
  NoiseBaselineUpdated: "noiseBaselineUpdated",
  NoiseReportSettingsUpdated: "noiseReportSettingsUpdated",
  StudyScheduleUpdated: "studyScheduleUpdated",
  WeatherSettingsUpdated: "weatherSettingsUpdated",
} as const;

// 事件名称类型（字符串字面量联合）
export type SettingsEventName = (typeof SETTINGS_EVENTS)[keyof typeof SETTINGS_EVENTS];

// 事件详情通用类型：避免使用 any，鼓励明确结构
export interface SettingsEventDetail {
  [key: string]: unknown;
}

/**
 * 广播设置事件
 * @param eventName 事件名称（来自 SETTINGS_EVENTS）
 * @param detail 可选的事件详情载荷
 */
export function broadcastSettingsEvent(
  eventName: SettingsEventName,
  detail?: SettingsEventDetail
): void {
  try {
    const ev = new CustomEvent(eventName, { detail });
    window.dispatchEvent(ev);
  } catch (error) {
    logger.error("广播设置事件失败:", eventName, error);
  }
}

/**
 * 订阅设置事件
 * @param eventName 事件名称（来自 SETTINGS_EVENTS）
 * @param handler 事件处理函数（参数类型为 CustomEvent）
 * @returns 取消订阅函数
 */
export function subscribeSettingsEvent(
  eventName: SettingsEventName,
  handler: (evt: CustomEvent) => void
): () => void {
  const listener = (evt: Event) => {
    handler(evt as CustomEvent);
  };
  window.addEventListener(eventName, listener as EventListener);
  return () => window.removeEventListener(eventName, listener as EventListener);
}
