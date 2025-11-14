import { useState, useEffect, useCallback } from "react";

import { logger } from "../utils/logger";

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
}

/**
 * 全屏API钩子
 * 提供全屏状态检测和切换功能，兼容不同浏览器的前缀
 * @returns [isFullscreen, toggleFullscreen] 全屏状态和切换函数
 */
export function useFullscreen(): [boolean, () => void] {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  /**
   * 检查当前是否处于全屏状态
   */
  const checkFullscreen = useCallback(() => {
    const doc = document as FullscreenDocument;
    const isCurrentlyFullscreen = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );
    setIsFullscreen(isCurrentlyFullscreen);
  }, []);

  /**
   * 进入全屏模式
   */
  const enterFullscreen = useCallback(async () => {
    const element = document.documentElement as FullscreenElement;

    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        await element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
      }
    } catch (error) {
      logger.warn("无法进入全屏模式:", error);
    }
  }, []);

  /**
   * 退出全屏模式
   */
  const exitFullscreen = useCallback(async () => {
    const doc = document as FullscreenDocument;

    try {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
      }
    } catch (error) {
      logger.warn("无法退出全屏模式:", error);
    }
  }, []);

  /**
   * 切换全屏状态
   */
  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  useEffect(() => {
    // 监听全屏状态变化事件
    const handleFullscreenChange = () => {
      checkFullscreen();
    };

    // 添加各种浏览器的全屏事件监听器
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    // 初始检查全屏状态
    checkFullscreen();

    return () => {
      // 清理事件监听器
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, [checkFullscreen]);

  return [isFullscreen, toggleFullscreen];
}
