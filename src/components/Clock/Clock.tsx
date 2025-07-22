import React, { useState, useCallback } from 'react';
import { useTimer } from '../../hooks/useTimer';
import { formatClock } from '../../utils/formatTime';
import styles from './Clock.module.css';

/**
 * 时钟组件
 * 显示当前系统时间，每秒更新一次
 */
export function Clock() {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  /**
   * 更新当前时间
   */
  const updateTime = useCallback(() => {
    setCurrentTime(new Date());
  }, []);

  // 使用计时器每秒更新时间
  useTimer(updateTime, true, 1000);

  const timeString = formatClock(currentTime);
  const dateString = currentTime.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  return (
    <div className={styles.clock}>
      <div className={styles.time} aria-live="polite">
        {timeString}
      </div>
      <div className={styles.date}>
        {dateString}
      </div>
    </div>
  );
}