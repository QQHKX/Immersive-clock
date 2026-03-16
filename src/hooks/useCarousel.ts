import { useState, useEffect, useCallback } from "react";

/**
 * 轮播 Hook
 * 用于管理自动轮播逻辑，支持暂停/继续和手动切换
 *
 * @template T - 轮播项的类型
 * @param items - 轮播项数组
 * @param intervalSec - 轮播间隔（秒），默认为 6 秒
 * @param autoplay - 是否自动播放，默认为 true
 * @returns 轮播状态和控制函数
 */
export function useCarousel<T>(
  items: T[],
  intervalSec: number = 6,
  autoplay: boolean = true
): {
  activeIndex: number;
  activeItem: T | undefined;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  pause: () => void;
  resume: () => void;
  isPaused: boolean;
} {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const activeItem = items[activeIndex];

  const next = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const prev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < items.length) {
        setActiveIndex(index);
      }
    },
    [items.length]
  );

  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);

  useEffect(() => {
    if (!autoplay || isPaused || items.length <= 1) {
      return;
    }

    const intervalMs = Math.max(1000, Math.min(60000, intervalSec * 1000));
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [items.length, intervalSec, autoplay, isPaused]);

  return {
    activeIndex,
    activeItem,
    next,
    prev,
    goTo,
    pause,
    resume,
    isPaused,
  };
}
