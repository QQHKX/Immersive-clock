/**
 * 噪音控制设置存储工具
 * 管理用户的最大允许噪音级别与手动基准噪音显示值
 */

// localStorage 键名
const NOISE_MAX_LEVEL_KEY = 'noise-control-max-level-db';
const NOISE_BASELINE_DB_KEY = 'noise-control-baseline-db';

export interface NoiseControlSettings {
  maxLevelDb: number; // 最大允许噪音级别（阈值）
  baselineDb: number; // 手动基准显示分贝
}

const DEFAULT_SETTINGS: NoiseControlSettings = {
  maxLevelDb: 55,
  baselineDb: 40,
};

export function getNoiseControlSettings(): NoiseControlSettings {
  try {
    const maxLevel = localStorage.getItem(NOISE_MAX_LEVEL_KEY);
    const baselineDb = localStorage.getItem(NOISE_BASELINE_DB_KEY);
    return {
      maxLevelDb: maxLevel !== null ? parseFloat(maxLevel) : DEFAULT_SETTINGS.maxLevelDb,
      baselineDb: baselineDb !== null ? parseFloat(baselineDb) : DEFAULT_SETTINGS.baselineDb,
    };
  } catch (error) {
    console.warn('读取噪音控制设置失败:', error);
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
  } catch (error) {
    console.error('保存噪音控制设置失败:', error);
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

export function resetNoiseControlSettings(): void {
  try {
    localStorage.removeItem(NOISE_MAX_LEVEL_KEY);
    localStorage.removeItem(NOISE_BASELINE_DB_KEY);
  } catch (error) {
    console.error('重置噪音控制设置失败:', error);
  }
}