import React, { useState, useCallback, useEffect } from 'react';
import { useAppState, useAppDispatch } from '../../contexts/AppContext';
import { useTimer } from '../../hooks/useTimer';
import { formatClock } from '../../utils/formatTime';
import { X } from 'react-feather';

import StudyStatus from '../StudyStatus';
import ScheduleSettings from '../ScheduleSettings';
import NoiseMonitor from '../NoiseMonitor';
import { MotivationalQuote } from '../MotivationalQuote';
import { StudyPeriod } from '../StudyStatus';
import styles from './Study.module.css';

/**
 * 晚自习组件
 * 显示当前时间和高考倒计时
 */
export function Study() {
  const { study } = useAppState();
  const dispatch = useAppDispatch();
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [showScheduleSettings, setShowScheduleSettings] = useState(false);
  const [targetYear, setTargetYear] = useState(study.targetYear);

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





  /**
   * 处理保存目标年份
   */
  const handleSaveTargetYear = useCallback(() => {
    dispatch({ type: 'SET_TARGET_YEAR', payload: targetYear });
    setShowSettings(false);
  }, [targetYear, dispatch]);

  /**
   * 处理课程表保存
   */
  const handleScheduleSave = useCallback((schedule: StudyPeriod[]) => {
    // 课程表已经在ScheduleSettings组件中保存到localStorage
    // 这里可以添加额外的处理逻辑
    setShowScheduleSettings(false);
  }, []);

  /**
   * 处理打开课程表设置
   */
  const handleOpenScheduleSettings = useCallback(() => {
    setShowScheduleSettings(true);
  }, []);

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
      <StudyStatus onSettingsClick={handleOpenScheduleSettings} />
      
      {/* 顶部信息栏 */}
      <div className={styles.header}>
        <div className={styles.timeInfo}>
          <div className={styles.currentTime}>{timeString}</div>
          <div className={styles.currentDate}>{dateString}</div>
          <NoiseMonitor />
        </div>
        <div className={styles.gaokaoInfo}>
          <div className={styles.gaokaoCountdown}>
            距离{study.targetYear}年高考还有 <span 
              className={styles.days}
              onClick={() => setShowSettings(true)}
              title="点击设置目标年份"
              style={{ cursor: 'pointer' }}
            >{daysToGaokao}</span> 天
          </div>
          {/* 励志金句模块 */}
          <MotivationalQuote />
        </div>
      </div>
      
      {/* 设置目标年份模态框 */}
      {showSettings && (
        <div className={styles.modal} onClick={() => setShowSettings(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>设置目标高考年份</h3>
              <button onClick={() => setShowSettings(false)} className={styles.closeButton}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <input
                type="number"
                value={targetYear}
                onChange={(e) => setTargetYear(parseInt(e.target.value) || new Date().getFullYear())}
                className={styles.yearInput}
                min={new Date().getFullYear()}
                max={new Date().getFullYear() + 10}
              />
            </div>
            <div className={styles.modalActions}>
              <button onClick={() => setShowSettings(false)} className={styles.cancelButton}>
                取消
              </button>
              <button onClick={handleSaveTargetYear} className={styles.confirmButton}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 课程表设置模态框 */}
      <ScheduleSettings
        isOpen={showScheduleSettings}
        onClose={() => setShowScheduleSettings(false)}
        onSave={handleScheduleSave}
      />
    </div>
  );
}