import React, { useMemo, useEffect, useState } from 'react';
import { FormSection } from '../FormComponents';
import styles from './NoiseSettings.module.css';

const NOISE_SAMPLE_STORAGE_KEY = 'noise-samples';
const NOISE_THRESHOLD = 55;

interface NoiseSample {
  t: number;
  v: number;
  s: 'quiet' | 'noisy';
}

export const RealTimeNoiseChart: React.FC = () => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const samples = useMemo<NoiseSample[]>(() => {
    try {
      const raw = localStorage.getItem(NOISE_SAMPLE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [tick]);

  const chart = useMemo(() => {
    const width = 600;
    const height = 160;
    const padding = 24;
    if (!samples.length) {
      return { width, height, path: '' };
    }

    // 仅显示最近5分钟的数据
    const now = Date.now();
    const windowMs = 5 * 60 * 1000;
    const cutoff = now - windowMs;
    const recent = samples.filter(s => s.t >= cutoff);
    if (!recent.length) {
      return { width, height, path: '' };
    }

    // 为了获得稳定的时间范围映射，使用固定窗口[start=cutoff, end=now]
    const minTs = cutoff;
    const maxTs = now;
    const span = Math.max(1, maxTs - minTs);
    const maxDb = 80;
    const minDb = 0;
    const mapX = (t: number) => padding + ((t - minTs) / span) * (width - padding * 2);
    const mapY = (v: number) => {
      const clamped = Math.max(minDb, Math.min(maxDb, v));
      const ratio = (clamped - minDb) / (maxDb - minDb);
      return height - padding - ratio * (height - padding * 2);
    };

    // 指数移动平均（EMA）平滑，不改变采样频率，仅用于绘制
    const alpha = 0.25; // 平滑系数，0<alpha<=1，越小越平滑
    const smoothed: number[] = [];
    for (let i = 0; i < recent.length; i++) {
      const v = recent[i].v;
      if (i === 0) {
        smoothed[i] = v;
      } else {
        smoothed[i] = alpha * v + (1 - alpha) * smoothed[i - 1];
      }
    }

    const pts = recent.map((s, i) => `${mapX(s.t)},${mapY(smoothed[i])}`);
    const path = pts.map((p, i) => (i === 0 ? `M ${p}` : `L ${p}`)).join(' ');
    return { width, height, path, startTs: minTs, endTs: maxTs } as { width: number; height: number; path: string; startTs: number; endTs: number };
  }, [samples]);

  return (
    <FormSection title="实时噪音曲线图">
      {chart.path ? (
        <svg width={chart.width} height={chart.height} className={styles.chart}>
          <line x1={24} y1={chart.height - 24} x2={chart.width - 24} y2={chart.height - 24} className={styles.axis} />
          <line x1={24} y1={24} x2={24} y2={chart.height - 24} className={styles.axis} />
          <line 
            x1={24} 
            x2={chart.width - 24} 
            y1={chart.height - 24 - (NOISE_THRESHOLD / 80) * (chart.height - 48)} 
            y2={chart.height - 24 - (NOISE_THRESHOLD / 80) * (chart.height - 48)} 
            className={styles.threshold} 
          />
          <path d={chart.path} className={styles.line} />
        </svg>
      ) : (
        <div className={styles.empty}>暂无采样数据或未授权麦克风。</div>
      )}
      <div className={styles.sourceNote} aria-live="polite">
        数据来源时间：{chart.path ? `${new Date(chart.startTs).toLocaleTimeString()} - ${new Date(chart.endTs).toLocaleTimeString()}` : '最近5分钟'}
      </div>
    </FormSection>
  );
};

export default RealTimeNoiseChart;