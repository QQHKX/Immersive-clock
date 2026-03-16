import React, { useState, useCallback } from "react";

import { useTimer } from "../../hooks/useTimer";
import { formatClock } from "../../utils/formatTime";
import { getAdjustedDate } from "../../utils/timeSync";

import styles from "./Clock.module.css";

/**
 * 时钟组件
 * 显示当前系统时间，每秒更新一次
 */
export function Clock() {
  const [currentTime, setCurrentTime] = useState<Date>(getAdjustedDate());

  /**
   * 更新当前时间
   */
  const updateTime = useCallback(() => {
    setCurrentTime(getAdjustedDate());
  }, []);

  // 使用计时器每秒更新时间
  useTimer(updateTime, true, 1000);

  const timeString = formatClock(currentTime);
  const dateString = currentTime.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <div className={styles.clock}>
      <div className={styles.time} aria-live="polite" aria-label={`当前时间：${timeString}`}>
        {timeString}
      </div>
      <div className={styles.date} aria-label={`当前日期：${dateString}`}>
        {dateString}
      </div>
    </div>
  );
}
