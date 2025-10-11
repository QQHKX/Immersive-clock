import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { FormSection } from '../FormComponents';
import styles from './NoiseSettings.module.css';
import { DEFAULT_SCHEDULE, StudyPeriod } from '../StudyStatus';
import { getNoiseControlSettings } from '../../utils/noiseControlSettings';

const NOISE_SAMPLE_STORAGE_KEY = 'noise-samples';
const getThreshold = () => getNoiseControlSettings().maxLevelDb;

interface NoiseSample {
  t: number;
  v: number;
  s: 'quiet' | 'noisy';
}

function formatDuration(ms: number) {
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}分${s}秒`;
}

export const NoiseStatsSummary: React.FC = () => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  // 计算当前课程时段（如果存在）
  const getCurrentPeriodRange = useCallback((): { start: Date; end: Date } | null => {
    try {
      // 支持两种键名，取存在且有效的为准
      const savedA = localStorage.getItem('study-schedule');
      const savedB = localStorage.getItem('studySchedule');
      let schedule: StudyPeriod[] = DEFAULT_SCHEDULE;
      if (savedA) {
        const parsed = JSON.parse(savedA);
        if (Array.isArray(parsed) && parsed.length > 0) schedule = parsed;
      } else if (savedB) {
        const parsed = JSON.parse(savedB);
        if (Array.isArray(parsed) && parsed.length > 0) schedule = parsed;
      }

      const toDate = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d;
      };

      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const sorted = [...schedule].sort((a, b) => parseInt(a.startTime.replace(':', '')) - parseInt(b.startTime.replace(':', '')));

      for (const p of sorted) {
        const start = toDate(p.startTime);
        const end = toDate(p.endTime);
        const startMin = start.getHours() * 60 + start.getMinutes();
        const endMin = end.getHours() * 60 + end.getMinutes();
        if (nowMin >= startMin && nowMin <= endMin) {
          // 统计范围：从本节开始到当前时刻（不超过该节结束）
          const rangeEnd = now.getTime() > end.getTime() ? end : now;
          return { start, end: rangeEnd };
        }
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const stats = useMemo(() => {
    try {
      const raw = localStorage.getItem(NOISE_SAMPLE_STORAGE_KEY);
      const all: NoiseSample[] = raw ? JSON.parse(raw) : [];
      // 仅统计当前课程时段的数据
      const range = getCurrentPeriodRange();
      const list = range ? all.filter(s => s.t >= range.start.getTime() && s.t <= range.end.getTime()) : [];
      if (list.length < 2) return { noisyDurationMs: 0, transitions: 0, avg: 0, max: 0 };
      let noisyDurationMs = 0;
      let transitions = 0;
      let sum = 0;
      let max = -Infinity;
      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1];
        const cur = list[i];
        sum += cur.v;
        if (cur.v > max) max = cur.v;
        const dt = cur.t - prev.t;
        const threshold = getThreshold();
        if (prev.v > threshold || cur.v > threshold) {
          noisyDurationMs += dt;
        }
        if (prev.v <= threshold && cur.v > threshold) {
          transitions++;
        }
      }
      const avg = sum / list.length;
      return { noisyDurationMs, transitions, avg, max };
    } catch {
      return { noisyDurationMs: 0, transitions: 0, avg: 0, max: 0 };
    }
  }, [tick, getCurrentPeriodRange]);

  return (
    <FormSection title="统计模块">
      <div className={styles.statsGrid}>
        <div className={styles.statItem}>
          <div className={styles.statLabel}>累计超标时长</div>
          <div className={styles.statValue}>{formatDuration(stats.noisyDurationMs)}</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statLabel}>提醒次数</div>
          <div className={styles.statValue}>{stats.transitions}</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statLabel}>平均噪音</div>
          <div className={styles.statValue}>{stats.avg.toFixed(1)} dB</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statLabel}>峰值噪音</div>
          <div className={styles.statValue}>{stats.max.toFixed(1)} dB</div>
        </div>
      </div>
      <div className={styles.sourceNote} aria-live="polite">
        数据来源时间：{(() => {
          const range = getCurrentPeriodRange();
          if (!range) return '当前无课程时段';
          const s = range.start.toLocaleTimeString();
          const e = range.end.toLocaleTimeString();
          return `${s} - ${e}`;
        })()}
      </div>
    </FormSection>
  );
};

export default NoiseStatsSummary;