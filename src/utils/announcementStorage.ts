/**
 * 公告本地存储工具函数
 * 用于管理"一周内不再显示"功能的本地存储逻辑
 */

const STORAGE_KEY = "immersive-clock-announcement";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 一周的毫秒数

interface AnnouncementStorageData {
  hideUntil: number; // 隐藏截止时间戳
  version: string; // 应用版本号
}

/**
 * 获取当前应用版本号
 * @returns string - 版本号
 */
const getCurrentVersion = (): string => {
  // 统一从环境变量获取版本号（vite.config 注入）
  return import.meta.env.VITE_APP_VERSION;
};

/**
 * 检查是否应该显示公告
 * @returns boolean - true表示应该显示，false表示不应该显示
 */
export const shouldShowAnnouncement = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return true; // 没有存储记录，应该显示
    }

    const data: AnnouncementStorageData = JSON.parse(stored);
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
    import("../utils/logger")
      .then(({ logger }) => logger.error("Error checking announcement visibility:", error))
      .catch(() => {});
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

    const data: AnnouncementStorageData = {
      hideUntil,
      version: currentVersion,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    import("../utils/logger")
      .then(({ logger }) => logger.error("Error setting announcement hide preference:", error))
      .catch(() => {});
  }
};

/**
 * 清除公告隐藏设置
 * @remarks 调试与重置辅助：清空“一周内不再显示”偏好。
 */
export const clearAnnouncementHidePreference = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    import("../utils/logger")
      .then(({ logger }) => logger.error("Error clearing announcement hide preference:", error))
      .catch(() => {});
  }
};

/**
 * 获取公告隐藏状态信息
 * @returns 返回包含隐藏状态详细信息的对象
 * @remarks 调试辅助：用于排查公告显示逻辑与缓存状态。
 */
export const getAnnouncementHideInfo = (): {
  isHidden: boolean;
  hideUntil: Date | null;
  version: string | null;
  remainingTime: number | null;
} => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {
        isHidden: false,
        hideUntil: null,
        version: null,
        remainingTime: null,
      };
    }

    const data: AnnouncementStorageData = JSON.parse(stored);
    const now = Date.now();
    const isHidden = now < data.hideUntil;
    const remainingTime = isHidden ? data.hideUntil - now : null;

    return {
      isHidden,
      hideUntil: new Date(data.hideUntil),
      version: data.version,
      remainingTime,
    };
  } catch (error) {
    import("../utils/logger")
      .then(({ logger }) => logger.error("Error getting announcement hide info:", error))
      .catch(() => {});
    return {
      isHidden: false,
      hideUntil: null,
      version: null,
      remainingTime: null,
    };
  }
};
