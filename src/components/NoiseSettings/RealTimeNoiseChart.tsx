import React, { useMemo, useEffect, useState } from 'react';
import { FormSection } from '../FormComponents';
import styles from './NoiseSettings.module.css';
import { getNoiseControlSettings } from '../../utils/noiseControlSettings';

const NOISE_SAMPLE_STORAGE_KEY = 'noise-samples';
const getThreshold = () => getNoiseControlSettings().maxLevelDb;

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
    // 固定窗口范围：最近5分钟
    const now = Date.now();
    const windowMs = 5 * 60 * 1000;
    const cutoff = now - windowMs;

    if (!samples.length) {
      return { width, height, padding, path: '', startTs: cutoff, endTs: now, xTicks: [], yTicks: [] };
    }

    // 仅显示最近5分钟的数据
    const recent = samples.filter(s => s.t >= cutoff);
    if (!recent.length) {
      return { width, height, padding, path: '', startTs: cutoff, endTs: now, xTicks: [], yTicks: [] };
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
    // 直接使用原始采样值绘制折线（去除平滑）
    const pts = recent.map((s) => `${mapX(s.t)},${mapY(s.v)}`);
    const path = pts.map((p, i) => (i === 0 ? `M ${p}` : `L ${p}`)).join(' ');

    // 生成与报告一致的刻度
    const xTickCount = 5;
    const xTicks = Array.from({ length: xTickCount }, (_, i) => {
      const t = minTs + (span * i) / (xTickCount - 1);
      return {
        x: mapX(t),
        y: height - padding,
        label: new Date(t).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })
      };
    });

    const yTickValues = [0, 20, 40, 60, 80];
    const yTicks = yTickValues.map((v) => ({
      x: padding,
      y: mapY(v),
      label: `${v}`
    }));

    const thresholdY = mapY(getThreshold());

    return { width, height, padding, path, startTs: minTs, endTs: maxTs, xTicks, yTicks, thresholdY };
  }, [samples]);

  return (
    <FormSection title="实时噪音曲线图">
      {chart.path ? (
        <svg width={chart.width} height={chart.height} className={styles.chart}>
          {/* 轴线 */}
          <line x1={chart.padding} y1={chart.height - chart.padding} x2={chart.width - chart.padding} y2={chart.height - chart.padding} className={styles.axis} />
          <line x1={chart.padding} y1={chart.padding} x2={chart.padding} y2={chart.height - chart.padding} className={styles.axis} />

          {/* 横向网格线 */}
          {chart.yTicks?.map((t: any, idx: number) => (
            <line key={`yg-${idx}`} x1={chart.padding} y1={t.y} x2={chart.width - chart.padding} y2={t.y} className={styles.gridLine} />
          ))}

          {/* X轴刻度与时间标签 */}
          {chart.xTicks?.map((t: any, idx: number) => (
            <g key={`xt-${idx}`}>
              <line x1={t.x} y1={chart.height - chart.padding - 4} x2={t.x} y2={chart.height - chart.padding + 4} className={styles.tick} />
              <text x={t.x} y={chart.height - chart.padding + 18} className={styles.tickLabel} textAnchor="middle">{t.label}</text>
            </g>
          ))}

          {/* Y轴刻度与分贝标签 */}
          {chart.yTicks?.map((t: any, idx: number) => (
            <g key={`yt-${idx}`}>
              <line x1={chart.padding - 4} y1={t.y} x2={chart.padding + 4} y2={t.y} className={styles.tick} />
              <text x={chart.padding - 8} y={t.y + 4} className={styles.tickLabel} textAnchor="end">{t.label}</text>
            </g>
          ))}

          {/* 阈值线 */}
          <line 
            x1={chart.padding} 
            x2={chart.width - chart.padding} 
            y1={chart.thresholdY} 
            y2={chart.thresholdY} 
            className={styles.threshold} 
          />

          {/* 折线路径 */}
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