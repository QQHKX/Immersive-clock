/**
 * 公告本地存储工具函数
 * 用于管理"一周内不再显示"功能的本地存储逻辑
 */
import { getAppSettings, updateAppSettings } from "./appSettings";
import { logger } from "./logger";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 一周的毫秒数

/**
 * 获取当前应用版本号
 * @returns string - 版本号
 */
const getCurrentVersion = (): string => {
  // 统一从环境变量获取版本号（vite.config 注入）
  return import.meta.env.VITE_APP_VERSION ?? "dev";
};

/**
 * 检查是否应该显示公告
 * @returns boolean - true表示应该显示，false表示不应该显示
 */
export const shouldShowAnnouncement = (): boolean => {
  try {
    const data = getAppSettings().general.announcement;
    const currentVersion = getCurrentVersion();
    const now = Date.now();

    // 如果版本号不同，重新显示公告
    if (data.version !== currentVersion) {
      return true;
    }

    // 如果还在隐藏期内，不显示
    if (now < data.hideUntil) {
      return false;
    }

    return true; // 隐藏期已过，应该显示
  } catch (error) {
    logger.error("检查公告显示状态时出错:", error);
    return true; // 出错时默认显示
  }
};

/**
 * 设置一周内不再显示公告
 */
export const setDontShowForWeek = (): void => {
  try {
    const currentVersion = getCurrentVersion();
    const hideUntil = Date.now() + ONE_WEEK_MS;
    updateAppSettings((current) => ({
      general: {
        ...current.general,
        announcement: {
          ...current.general.announcement,
          hideUntil,
          version: currentVersion,
        },
      },
    }));
  } catch (error) {
    logger.error("设置公告隐藏偏好时出错:", error);
  }
};

/**
 * 清除公告隐藏设置
 */
export const clearAnnouncementHidePreference = (): void => {
  try {
    updateAppSettings((current) => ({
      general: {
        ...current.general,
        announcement: {
          ...current.general.announcement,
          hideUntil: 0,
          version: "",
        },
      },
    }));
  } catch (error) {
    logger.error("清除公告隐藏偏好时出错:", error);
  }
};

/**
 * 获取公告隐藏状态信息
 */
export const getAnnouncementHideInfo = (): {
  isHidden: boolean;
  hideUntil: Date | null;
  version: string | null;
  remainingTime: number | null;
} => {
  try {
    const data = getAppSettings().general.announcement;
    const now = Date.now();
    const isHidden = now < data.hideUntil;
    const remainingTime = isHidden ? data.hideUntil - now : null;

    return {
      isHidden,
      hideUntil: data.hideUntil ? new Date(data.hideUntil) : null,
      version: data.version || null,
      remainingTime,
    };
  } catch (error) {
    logger.error("Error getting announcement hide info:", error);
    return {
      isHidden: false,
      hideUntil: null,
      version: null,
      remainingTime: null,
    };
  }
};
