/**
 * 噪音控制设置存储工具
 * 管理用户的最大允许噪音级别与手动基准噪音显示值
 */
import {
  NOISE_ANALYSIS_FRAME_MS,
  NOISE_ANALYSIS_SLICE_SEC,
  NOISE_SCORE_MAX_SEGMENTS_PER_MIN,
  NOISE_SCORE_SEGMENT_MERGE_GAP_MS,
  NOISE_SCORE_THRESHOLD_DBFS,
} from "../constants/noise";

import { getAppSettings, updateNoiseSettings } from "./appSettings";
import { logger } from "./logger";
import { broadcastSettingsEvent, SETTINGS_EVENTS } from "./settingsEvents";

// localStorage 键名 (不再使用，保留注释或直接移除)
// ...

export interface NoiseControlSettings {
  maxLevelDb: number; // 最大允许噪音级别
  baselineDb: number; // 手动基准显示分贝
  showRealtimeDb: boolean; // 是否显示实时分贝
  avgWindowSec: number; // 噪音平均时间窗（秒）
  sliceSec: number;
  frameMs: number;
  scoreThresholdDbfs: number;
  segmentMergeGapMs: number;
  maxSegmentsPerMin: number;
  alertSoundEnabled: boolean; // 超过阈值时播放提示音
}

const FIXED_NOISE_ANALYSIS_SETTINGS: Pick<
  NoiseControlSettings,
  "sliceSec" | "frameMs" | "scoreThresholdDbfs" | "segmentMergeGapMs" | "maxSegmentsPerMin"
> = {
  sliceSec: NOISE_ANALYSIS_SLICE_SEC,
  frameMs: NOISE_ANALYSIS_FRAME_MS,
  scoreThresholdDbfs: NOISE_SCORE_THRESHOLD_DBFS,
  segmentMergeGapMs: NOISE_SCORE_SEGMENT_MERGE_GAP_MS,
  maxSegmentsPerMin: NOISE_SCORE_MAX_SEGMENTS_PER_MIN,
};

const DEFAULT_SETTINGS: NoiseControlSettings = {
  maxLevelDb: 55,
  baselineDb: 40,
  showRealtimeDb: true,
  avgWindowSec: 1,
  ...FIXED_NOISE_ANALYSIS_SETTINGS,
  alertSoundEnabled: false,
};

/**
 * 将“分析与评分”的高级参数固定为程序内配置，避免被设置面板或旧缓存覆盖。
 */
function applyFixedNoiseAnalysisSettings(settings: NoiseControlSettings): NoiseControlSettings {
  return { ...settings, ...FIXED_NOISE_ANALYSIS_SETTINGS };
}

export function getNoiseControlSettings(): NoiseControlSettings {
  return applyFixedNoiseAnalysisSettings(getAppSettings().noiseControl as NoiseControlSettings);
}

export function saveNoiseControlSettings(settings: Partial<NoiseControlSettings>): void {
  try {
    updateNoiseSettings({ ...settings, ...FIXED_NOISE_ANALYSIS_SETTINGS });

    const next = getAppSettings().noiseControl;

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
    updateNoiseSettings(DEFAULT_SETTINGS);
    // 广播：重置后也应通知订阅者使用默认值
    broadcastSettingsEvent(SETTINGS_EVENTS.NoiseControlSettingsUpdated, {
      settings: getNoiseControlSettings(),
    });
  } catch (error) {
    logger.error("重置噪音控制设置失败:", error);
  }
}
