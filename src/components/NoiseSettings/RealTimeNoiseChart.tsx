import React, { useEffect, useMemo, useState } from 'react';
import styles from './NoiseSettings.module.css';
import { FormSection } from '../FormComponents';
import { getNoiseControlSettings } from '../../utils/noiseControlSettings';
import { readNoiseSamples, subscribeNoiseSamplesUpdated } from '../../utils/noiseDataService';

const getThreshold = () => getNoiseControlSettings().maxLevelDb;

interface NoiseSample {
  t: number;
  v: number;
  s: 'quiet' | 'noisy';
}

export const RealTimeNoiseChart: React.FC = () => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeNoiseSamplesUpdated(() => setTick(t => t + 1));
    setTick(t => t + 1);
    return unsubscribe;
  }, []);

  const { points, threshold, latest, width, height, margin, yTicks, yScale, path, thresholdY } = useMemo(() => {
    const all: NoiseSample[] = readNoiseSamples();
    const threshold = getThreshold();
    const now = Date.now();
    const cutoff = now - 5 * 60 * 1000; // 显示最近5分钟
    const points = all.filter(s => s.t >= cutoff);
    const latest = points.length ? points[points.length - 1] : null;

    const width = 640; // 通过 viewBox 适配容器宽度
    const height = 160;
    const margin = { top: 12, right: 12, bottom: 22, left: 36 };

    const values = points.map(p => p.v);
    const minV = values.length ? Math.min(...values, threshold) : threshold - 10;
    const maxV = values.length ? Math.max(...values, threshold) : threshold + 10;
    const pad = Math.max(2, (maxV - minV) * 0.1);
    const yMin = Math.max(30, Math.floor(minV - pad));
    const yMax = Math.min(90, Math.ceil(maxV + pad));

    const xScale = (t: number) => {
      const x0 = margin.left;
      const x1 = width - margin.right;
      return x0 + ((t - cutoff) / (5 * 60 * 1000)) * (x1 - x0);
    };
    const yScale = (v: number) => {
      const y0 = height - margin.bottom;
      const y1 = margin.top;
      return y0 - ((v - yMin) / (yMax - yMin)) * (y0 - y1);
    };

    // 计算Y轴刻度
    const niceTicks = (min: number, max: number, count: number) => {
      const step = (max - min) / count;
      const pow10 = Math.pow(10, Math.floor(Math.log10(step)));
      const niceStep = Math.max(1, Math.round(step / pow10) * pow10);
      const start = Math.ceil(min / niceStep) * niceStep;
      const ticks: number[] = [];
      for (let v = start; v <= max; v += niceStep) ticks.push(v);
      return ticks;
    };
    const yTicks = niceTicks(yMin, yMax, 5);

    // 生成折线路径
    const path = points.length
      ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.t)} ${yScale(p.v)}`).join(' ')
      : '';

    const thresholdY = yScale(threshold);

    return { points, threshold, latest, width, height, margin, yTicks, yScale, path, thresholdY };
  }, [tick]);

  return (
    <FormSection title="实时噪音曲线">
      <div className={styles.chartHeader}>
        <div>阈值：{threshold.toFixed(0)} dB</div>
        <div>当前：{latest ? `${latest.v.toFixed(1)} dB` : '—'}</div>
      </div>
      <div className={styles.chart}>
        {points.length === 0 ? (
          <div className={styles.empty}>暂无数据</div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="最近5分钟噪音折线图">
            {/* 网格与Y轴刻度 */}
            {yTicks.map((yt, i) => (
              <g key={`ytick-${i}`}>
                <line x1={margin.left} x2={width - margin.right} y1={yScale(yt)} y2={yScale(yt)} className={styles.gridLine} />
                <text x={margin.left - 8} y={yScale(yt)} dy="0.32em" textAnchor="end" className={styles.tickLabel}>{yt.toFixed(0)}</text>
              </g>
            ))}

            {/* 阈值线 */}
            <line x1={margin.left} x2={width - margin.right} y1={thresholdY} y2={thresholdY} className={styles.threshold} />

            {/* 折线 */}
            <path d={path} className={styles.line} />

            {/* 边框轴 */}
            <line x1={margin.left} x2={width - margin.right} y1={height - margin.bottom} y2={height - margin.bottom} className={styles.axis} />
            <line x1={margin.left} x2={margin.left} y1={margin.top} y2={height - margin.bottom} className={styles.axis} />
          </svg>
        )}
      </div>
      <div className={styles.sourceNote}>显示最近5分钟的平均分贝；每秒刷新。</div>
    </FormSection>
  );
};

export default RealTimeNoiseChart;