import React, { useCallback } from "react";

import { STOPWATCH_TICK_MS } from "../../constants/timer";
import { useAppState, useAppDispatch } from "../../contexts/AppContext";
import { useAccumulatingTimer } from "../../hooks/useTimer";
import { formatStopwatch } from "../../utils/formatTime";

import styles from "./Stopwatch.module.css";

/**
 * 秒表组件
 * 显示秒表时间，支持启动、暂停、重置功能
 * 使用高频计时器确保精确计时
 */
export function Stopwatch() {
  const { stopwatch } = useAppState();
  const dispatch = useAppDispatch();

  /**
   * 秒表递增处理函数
   */
  const handleTick = useCallback(
    (count: number) => {
      // 一次性派发补偿量，减少多次 dispatch
      dispatch({ type: "TICK_STOPWATCH_BY", payload: count });
    },
    [dispatch]
  );

  // 使用累积计时器：按10ms间隔计算应触发次数，一次性派发
  useAccumulatingTimer(handleTick, stopwatch.isActive, STOPWATCH_TICK_MS);

  const timeString = formatStopwatch(stopwatch.elapsedTime);
  const totalSeconds = Math.floor(stopwatch.elapsedTime / 1000);
  const isLongDuration = totalSeconds >= 3600; // 1小时以上

  return (
    <div className={styles.stopwatch}>
      <div
        className={`${styles.time} ${stopwatch.isActive ? styles.running : ""}`}
        aria-live="polite"
      >
        {stopwatch.elapsedTime === 0 ? (
          <span className={styles.placeholder}>00:00:00</span>
        ) : (
          timeString
        )}
      </div>

      {stopwatch.elapsedTime > 0 && !stopwatch.isActive && (
        <div className={styles.status}>已暂停</div>
      )}

      {isLongDuration && <div className={styles.milestone}>🎉 已超过1小时！</div>}
    </div>
  );
}
