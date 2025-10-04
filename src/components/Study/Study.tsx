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
   * 计算距离高考的天数（基于最近的目标年份）
   */
  const calculateDaysToGaokao = useCallback(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    let gaokaoDate: Date;

    // 目标年份为当年，若已过6月7日则使用下一年
    if (study.targetYear === currentYear) {
      const thisYearGaokao = new Date(currentYear, 5, 7);
      gaokaoDate = now > thisYearGaokao ? new Date(currentYear + 1, 5, 7) : thisYearGaokao;
    } else {
      gaokaoDate = new Date(study.targetYear, 5, 7);
      // 如果选择的目标年份已过当前日期，仍按该年6月7日计算剩余天数（可能为0）
    }

    const diffTime = gaokaoDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [study.targetYear]);

  /**
   * 计算距离自定义事件的天数
   */
  const calculateDaysToCustom = useCallback(() => {
    const now = new Date();
    if (!study.customDate) return 0;
    const [y, m, d] = study.customDate.split('-').map(Number);
    if (!y || !m || !d) return 0;
    const eventDate = new Date(y, (m - 1), d);
    const diffTime = eventDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [study.customDate]);







  const timeString = formatClock(currentTime);
  const dateString = currentTime.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
  const daysToGaokao = calculateDaysToGaokao();
  const daysToCustom = calculateDaysToCustom();

  const isCustom = (study.countdownType ?? 'gaokao') === 'custom';
  const countdownLabel = isCustom
    ? `距离${(study.customName && study.customName.trim()) || '自定义事件'}仅`
    : `距离${study.targetYear}年高考仅`;
  const countdownDays = isCustom ? daysToCustom : daysToGaokao;

  return (
    <div className={styles.study}>
      {/* 智能晚自习状态管理 */}
      <StudyStatus />
      
      {/* 左上角 - 噪音监测 */}
      <div className={styles.topLeft}>
        <NoiseMonitor />
      </div>
      
      {/* 右上角 - 倒计时和励志金句 */}
      <div className={styles.topRight}>
        <div className={styles.gaokaoCountdown}>
          {countdownLabel} <span className={styles.days}>{countdownDays}</span> 天
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