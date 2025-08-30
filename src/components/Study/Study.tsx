import React, { useState, useCallback, useEffect } from 'react';
import { useAppState, useAppDispatch } from '../../contexts/AppContext';
import { useTimer } from '../../hooks/useTimer';
import { formatClock } from '../../utils/formatTime';

import StudyStatus from '../StudyStatus';
import NoiseMonitor from '../NoiseMonitor';
import { MotivationalQuote } from '../MotivationalQuote';
import styles from './Study.module.css';

/**
 * 晚自习组件
 * 显示当前时间和高考倒计时
 */
export function Study() {
  const { study } = useAppState();
  const dispatch = useAppDispatch();
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  /**
   * 更新当前时间
   */
  const updateTime = useCallback(() => {
    setCurrentTime(new Date());
  }, []);

  // 使用计时器每秒更新时间
  useTimer(updateTime, true, 1000);

  // 组件挂载时立即更新时间
  useEffect(() => {
    updateTime();
  }, [updateTime]);

  /**
   * 计算距离高考的天数
   */
  const calculateDaysToGaokao = useCallback(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    let gaokaoDate: Date;
    
    // 如果目标年份是当年，且已经过了6月7日，则计算下一年的高考
    if (study.targetYear === currentYear) {
      const thisYearGaokao = new Date(currentYear, 5, 7); // 6月7日（月份从0开始）
      if (now > thisYearGaokao) {
        gaokaoDate = new Date(currentYear + 1, 5, 7);
      } else {
        gaokaoDate = thisYearGaokao;
      }
    } else {
      gaokaoDate = new Date(study.targetYear, 5, 7);
    }
    
    const diffTime = gaokaoDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [study.targetYear]);







  const timeString = formatClock(currentTime);
  const dateString = currentTime.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
  const daysToGaokao = calculateDaysToGaokao();

  return (
    <div className={styles.study}>
      {/* 智能晚自习状态管理 */}
      <StudyStatus />
      
      {/* 左上角 - 噪音监测 */}
      <div className={styles.topLeft}>
        <NoiseMonitor />
      </div>
      
      {/* 右上角 - 高考倒计时和励志金句 */}
      <div className={styles.topRight}>
        <div className={styles.gaokaoCountdown}>
          距离{study.targetYear}年高考仅 <span className={styles.days}>{daysToGaokao}</span> 天
        </div>
        <div className={styles.quoteSection}>
          <MotivationalQuote />
        </div>
      </div>
      
      {/* 中央 - 时间显示 */}
      <div className={styles.centerTime}>
        <div className={styles.currentTime}>{timeString}</div>
        <div className={styles.currentDate}>{dateString}</div>
      </div>
    </div>
  );
}