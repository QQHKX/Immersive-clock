import { useEffect, useRef } from 'react';

/**
 * 高精度计时器钩子
 * 使用 requestAnimationFrame 实现平滑的计时器更新
 * @param callback 每次计时器触发时执行的回调函数
 * @param isActive 计时器是否激活
 * @param interval 计时器间隔（毫秒），默认为1000ms
 */
export function useTimer(
  callback: () => void,
  isActive: boolean,
  interval: number = 1000
): void {
  const callbackRef = useRef(callback);
  const intervalRef = useRef(interval);
  const lastTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  // 更新回调函数引用
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // 更新间隔引用
  useEffect(() => {
    intervalRef.current = interval;
  }, [interval]);

  useEffect(() => {
    if (!isActive) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }
      lastTimeRef.current = 0;
      return;
    }

    /**
     * 计时器循环函数
     * @param currentTime 当前时间戳
     */
    const tick = (currentTime: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime;
      }

      const elapsed = currentTime - lastTimeRef.current;

      if (elapsed >= intervalRef.current) {
        callbackRef.current();
        lastTimeRef.current = currentTime;
      }

      if (isActive) {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive]);
}

/**
 * 高频计时器钩子（用于秒表等需要高精度的场景）
 * @param callback 回调函数
 * @param isActive 是否激活
 */
export function useHighFrequencyTimer(
  callback: () => void,
  isActive: boolean
): void {
  return useTimer(callback, isActive, 10); // 10ms 间隔
}