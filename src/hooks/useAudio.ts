import { useState, useEffect, useRef, useCallback } from "react";

import { logger } from "../utils/logger";

/**
 * 音频管理钩子
 * 提供音频预加载和播放功能
 * @param src 音频文件路径
 * @returns [play, isReady] 播放函数和就绪状态
 */
export function useAudio(src: string): [() => void, boolean] {
  const [isReady, setIsReady] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /**
   * 播放音频
   */
  const play = useCallback(() => {
    if (audioRef.current && isReady) {
      try {
        // 重置播放位置到开始
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((error) => {
          logger.warn("音频播放失败:", error);
        });
      } catch (error) {
        logger.warn("音频播放出错:", error);
      }
    }
  }, [isReady]);

  useEffect(() => {
    // 创建音频元素
    const audio = new Audio(src);
    audioRef.current = audio;

    /**
     * 音频加载完成处理函数
     */
    const handleCanPlayThrough = () => {
      setIsReady(true);
    };

    /**
     * 音频加载错误处理函数
     */
    const handleError = (error: Event) => {
      logger.warn("音频加载失败:", error);
      setIsReady(false);
    };

    /**
     * 音频加载开始处理函数
     */
    const handleLoadStart = () => {
      setIsReady(false);
    };

    // 添加事件监听器
    audio.addEventListener("canplaythrough", handleCanPlayThrough);
    audio.addEventListener("error", handleError);
    audio.addEventListener("loadstart", handleLoadStart);

    // 设置音频属性
    audio.preload = "auto";
    audio.volume = 0.7; // 设置音量为70%

    // 开始预加载
    audio.load();

    return () => {
      // 清理事件监听器
      audio.removeEventListener("canplaythrough", handleCanPlayThrough);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("loadstart", handleLoadStart);

      // 清理音频资源
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [src]);

  return [play, isReady];
}

/**
 * 多音频管理钩子
 * 管理多个音频文件的预加载和播放
 * @param audioSources 音频源对象，键为音频名称，值为音频路径
 * @returns [playAudio, audioStates] 播放函数和音频状态对象
 */
export function useMultipleAudio(
  audioSources: Record<string, string>
): [(audioName: string) => void, Record<string, boolean>] {
  const [audioStates, setAudioStates] = useState<Record<string, boolean>>({});
  const audioRefsRef = useRef<Record<string, HTMLAudioElement>>({});

  /**
   * 播放指定音频
   * @param audioName 音频名称
   */
  const playAudio = useCallback(
    (audioName: string) => {
      const audio = audioRefsRef.current[audioName];
      if (audio && audioStates[audioName]) {
        try {
          audio.currentTime = 0;
          audio.play().catch((error) => {
            logger.warn(`音频 ${audioName} 播放失败:`, error);
          });
        } catch (error) {
          logger.warn(`音频 ${audioName} 播放出错:`, error);
        }
      }
    },
    [audioStates]
  );

  useEffect(() => {
    const audioRefs = audioRefsRef.current;
    const newAudioStates: Record<string, boolean> = {};

    // 为每个音频源创建音频元素
    Object.entries(audioSources).forEach(([name, src]) => {
      const audio = new Audio(src);
      audioRefs[name] = audio;
      newAudioStates[name] = false;

      const handleCanPlayThrough = () => {
        setAudioStates((prev) => ({ ...prev, [name]: true }));
      };

      const handleError = (error: Event) => {
        logger.warn(`音频 ${name} 加载失败:`, error);
        setAudioStates((prev) => ({ ...prev, [name]: false }));
      };

      audio.addEventListener("canplaythrough", handleCanPlayThrough);
      audio.addEventListener("error", handleError);
      audio.preload = "auto";
      audio.volume = 0.7;
      audio.load();
    });

    setAudioStates(newAudioStates);

    return () => {
      // 清理所有音频资源
      Object.values(audioRefs).forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
      audioRefsRef.current = {};
    };
  }, [audioSources]);

  return [playAudio, audioStates];
}
