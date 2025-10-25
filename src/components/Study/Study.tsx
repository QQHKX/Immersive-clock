import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAppState, useAppDispatch } from '../../contexts/AppContext';
import { useTimer } from '../../hooks/useTimer';
import { formatClock } from '../../utils/formatTime';

import StudyStatus from '../StudyStatus';
import NoiseMonitor from '../NoiseMonitor';
import { MotivationalQuote } from '../MotivationalQuote';
import styles from './Study.module.css';
import NoiseReportModal, { NoiseReportPeriod } from '../NoiseReportModal/NoiseReportModal';
import NoiseHistoryModal from '../NoiseHistoryModal/NoiseHistoryModal';
import { DEFAULT_SCHEDULE, StudyPeriod } from '../StudyStatus/StudyStatus';
import { getAutoPopupSetting } from '../../utils/noiseReportSettings';
import { readStudyBackground } from '../../utils/studyBackgroundStorage';

/**
 * 晚自习组件
 * 显示当前时间和高考倒计时
 */
export function Study() {
  const { study } = useAppState();
  const dispatch = useAppDispatch();
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<NoiseReportPeriod | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // 记录当前课时是否已弹出过报告，以及是否被手动关闭以避免重复弹出
  const lastPopupPeriodIdRef = useRef<string | null>(null);
  const dismissedPeriodIdRef = useRef<string | null>(null);

  // 背景设置
  const [backgroundSettings, setBackgroundSettings] = useState(readStudyBackground());

  // 新增：用于测量倒计时文本的实际宽度
  const countdownRef = useRef<HTMLDivElement | null>(null);
  const [countdownWidth, setCountdownWidth] = useState<number>(0);

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

  // 监听背景设置更新事件
  useEffect(() => {
    const handler = () => setBackgroundSettings(readStudyBackground());
    window.addEventListener('study-background-updated', handler as EventListener);
    return () => window.removeEventListener('study-background-updated', handler as EventListener);
  }, []);

  // 自动在本节课结束前1分钟弹出统计报告（不自动关闭；若手动关闭则在该课时结束前不再弹出）
  useEffect(() => {
    const scheduleRaw = localStorage.getItem('study-schedule') || localStorage.getItem('studySchedule');
    let schedule: StudyPeriod[] = DEFAULT_SCHEDULE;
    try {
      if (scheduleRaw) {
        const parsed = JSON.parse(scheduleRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          schedule = parsed;
        }
      }
    } catch {}

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const toDate = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    };

    for (const p of schedule) {
      const start = toDate(p.startTime);
      const end = toDate(p.endTime);
      const startMin = start.getHours() * 60 + start.getMinutes();
      const endMin = end.getHours() * 60 + end.getMinutes();

      // 课时已结束，重置当前课时的弹出/关闭标记
      if (nowMin >= endMin) {
        if (lastPopupPeriodIdRef.current === p.id) {
          lastPopupPeriodIdRef.current = null;
        }
        if (dismissedPeriodIdRef.current === p.id) {
          dismissedPeriodIdRef.current = null;
        }
      }

      // 正在本节课内，并且进入结束前1分钟窗口（[end-1min, end)）
      if (nowMin >= startMin && nowMin < endMin && (endMin - nowMin) <= 1) {
        // 检查是否启用自动弹出设置
        const autoPopupEnabled = getAutoPopupSetting();
        
        // 若本课时已经弹出过，或被手动关闭过，或设置中禁用了自动弹出，则不再重复弹出
        const alreadyPopped = lastPopupPeriodIdRef.current === p.id;
        const dismissed = dismissedPeriodIdRef.current === p.id;
        if (!alreadyPopped && !dismissed && autoPopupEnabled) {
          setReportPeriod({ id: p.id, name: p.name, start, end });
          setReportOpen(true);
          lastPopupPeriodIdRef.current = p.id;
        }
        break;
      }
    }
  }, [currentTime, reportOpen]);

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

  // 监听窗口大小与倒计时文案变化，测量倒计时宽度
  useEffect(() => {
    const measure = () => {
      if (countdownRef.current) {
        setCountdownWidth(countdownRef.current.offsetWidth);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [countdownLabel, countdownDays]);

  // 背景样式
  const backgroundStyle: React.CSSProperties = (() => {
    const style: React.CSSProperties = {};
    if (backgroundSettings?.type === 'image' && backgroundSettings.imageDataUrl) {
      style.backgroundImage = `url(${backgroundSettings.imageDataUrl})`;
      style.backgroundSize = 'cover';
      style.backgroundPosition = 'center';
      style.backgroundRepeat = 'no-repeat';
    } else if (backgroundSettings?.type === 'color' && backgroundSettings.color) {
      style.backgroundImage = 'none';
      style.backgroundColor = backgroundSettings.color;
    }
    return style;
  })();

  // 手动关闭报告：记录当前课时的关闭标记，避免在窗口内重复弹出
  const handleCloseReport = useCallback(() => {
    if (reportPeriod) {
      dismissedPeriodIdRef.current = reportPeriod.id;
    }
    setReportOpen(false);
  }, [reportPeriod]);

  // 点击状态文本时打开历史记录弹窗
  const handleOpenHistory = useCallback(() => {
    setHistoryOpen(true);
  }, []);

  const handleCloseHistory = useCallback(() => {
    setHistoryOpen(false);
  }, []);

  return (
    <div className={styles.study} style={backgroundStyle}>
      {/* 智能晚自习状态管理 */}
      <StudyStatus />
      
      {/* 左上角 - 噪音监测 */}
      <div className={styles.topLeft}>
        <NoiseMonitor onStatusClick={handleOpenHistory} />
      </div>
      
      {/* 右上角 - 倒计时和励志金句 */}
      <div className={styles.topRight}>
        <div className={styles.gaokaoCountdown} ref={countdownRef}>
          {countdownLabel} <span className={styles.days}>{countdownDays}</span> 天
        </div>
        <div className={styles.quoteSection} style={{ width: countdownWidth || undefined }}>
          <MotivationalQuote />
        </div>
      </div>
      
      {/* 中央 - 时间显示 */}
      <div className={styles.centerTime}>
        <div className={styles.currentTime}>{timeString}</div>
        <div className={styles.currentDate}>{dateString}</div>
      </div>

      {/* 统计报告弹窗 */}
      <NoiseReportModal 
        isOpen={reportOpen} 
        onClose={handleCloseReport} 
        period={reportPeriod} 
      />

      {/* 历史记录弹窗 */}
      <NoiseHistoryModal isOpen={historyOpen} onClose={handleCloseHistory} />
    </div>
  );
}