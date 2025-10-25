import React, { useMemo, useRef, useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import { FormSection, FormButton, FormButtonGroup } from '../FormComponents';
import styles from './NoiseReportModal.module.css';
import { saveNoiseReport, SavedNoiseReport } from '../../utils/noiseReportStorage';
import { getNoiseControlSettings } from '../../utils/noiseControlSettings';
import { readNoiseSamples, subscribeNoiseSamplesUpdated } from '../../utils/noiseDataService';

export interface NoiseReportPeriod {
  id: string;
  name: string;
  start: Date;
  end: Date;
}

interface NoiseSample {
  t: number; // timestamp
  v: number; // volume (dB)
  s: 'quiet' | 'noisy';
}

interface NoiseReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  period: NoiseReportPeriod | null;
  // 可选：用于测试或外部覆盖的示例数据
  samplesOverride?: NoiseSample[];
}

const getThreshold = () => getNoiseControlSettings().maxLevelDb; // 从设置读取阈值
const CHART_HEIGHT = 160;
const CHART_PADDING = 36;

export const NoiseReportModal: React.FC<NoiseReportModalProps> = ({ isOpen, onClose, period, samplesOverride }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(860);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const measure = () => {
      const w = chartContainerRef.current?.clientWidth || 860;
      setChartWidth(w);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
    };
  }, [isOpen]);

  // 当噪音样本更新时，如果弹窗打开则刷新
  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = subscribeNoiseSamplesUpdated(() => setTick(t => t + 1));
    // 打开后立即触发一次，避免初次为空
    setTick(t => t + 1);
    return unsubscribe;
  }, [isOpen]);

  const samplesInPeriod = useMemo<NoiseSample[]>(() => {
    if (!period) return [];
    const startTs = period.start.getTime();
    const endTs = period.end.getTime();
    if (samplesOverride && samplesOverride.length) {
      return samplesOverride.filter(item => item.t >= startTs && item.t <= endTs);
    }
    try {
      const all: NoiseSample[] = readNoiseSamples();
      return all.filter(item => item.t >= startTs && item.t <= endTs);
    } catch {
      return [];
    }
  }, [period, samplesOverride, tick]);

  const stats = useMemo(() => {
    if (!samplesInPeriod.length || !period) {
      return {
        avg: 0,
        max: 0,
        noisyDurationMs: 0,
        transitions: 0,
        durationMs: 0,
      };
    }

    let sum = 0;
    let max = -Infinity;
    let transitions = 0;
    let noisyDurationMs = 0;

    const threshold = getThreshold();
    for (let i = 1; i < samplesInPeriod.length; i++) {
      const prev = samplesInPeriod[i - 1];
      const cur = samplesInPeriod[i];
      sum += cur.v;
      if (cur.v > max) max = cur.v;
      const dt = cur.t - prev.t;
      if (prev.v > threshold || cur.v > threshold) {
        noisyDurationMs += dt;
      }
      if (prev.v <= threshold && cur.v > threshold) transitions++;
    }

    const durationMs = period.end.getTime() - period.start.getTime();
    const avg = sum / samplesInPeriod.length;

    return { avg, max, noisyDurationMs, transitions, durationMs };
  }, [samplesInPeriod, period]);

  // 基于当前时段样本生成 SVG 折线图数据
  const chart = useMemo(() => {
    const width = chartWidth;
    const height = CHART_HEIGHT;
    const padding = CHART_PADDING;
    const minDb = 0;
    const maxDb = 80;
    if (!period || samplesInPeriod.length === 0) {
      const thresholdY = height - padding - ((getThreshold() - minDb) / (maxDb - minDb)) * (height - padding * 2);
      return { width, height, padding, path: '', thresholdY };
    }
    const startTs = period.start.getTime();
    const endTs = period.end.getTime();
    const span = Math.max(1, endTs - startTs);
    const mapX = (t: number) => padding + ((t - startTs) / span) * (width - padding * 2);
    const mapY = (v: number) => height - padding - ((v - minDb) / (maxDb - minDb)) * (height - padding * 2);
    const pts = samplesInPeriod.map(p => ({ x: mapX(p.t), y: mapY(p.v) }));
    const path = pts.map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`)).join(' ');
    const thresholdY = mapY(getThreshold());
    return { width, height, padding, path, thresholdY };
  }, [samplesInPeriod, chartWidth, period]);

  // 渲染逻辑保持不变，仅数据来源统一
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="噪音报告">
      <FormSection title="报告概览">
        <div className={styles.summaryRow}>
          <div>平均噪音：{stats.avg.toFixed(1)} dB</div>
          <div>峰值噪音：{stats.max.toFixed(1)} dB</div>
          <div>超标时长：{Math.round(stats.noisyDurationMs / 1000)} 秒</div>
          <div>提醒次数：{stats.transitions}</div>
        </div>
      </FormSection>
      <FormSection title="数据曲线">
        <div ref={chartContainerRef} className={styles.chartRow}>
          {samplesInPeriod.length > 0 ? (
            <svg
              width={chart.width}
              height={chart.height}
              className={styles.chart}
              viewBox={`0 0 ${chart.width} ${chart.height}`}
            >
              <defs>
                <linearGradient id="reportAreaGradient" x1="0" y1="0" x2="0" y2={chart.height} gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#03DAC6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#03DAC6" stopOpacity={0} />
                </linearGradient>
              </defs>

              {/* 阈值线 */}
              <line x1={chart.padding} y1={chart.thresholdY} x2={chart.width - chart.padding} y2={chart.thresholdY} className={styles.threshold} />
              {/* 折线 */}
              <path d={chart.path} className={styles.line} />
              {/* 面积填充 */}
              <path d={`${chart.path} L ${chart.width - chart.padding} ${chart.height - chart.padding} L ${chart.padding} ${chart.height - chart.padding} Z`} fill="url(#reportAreaGradient)" className={styles.area} />
            </svg>
          ) : (
            <div className={styles.empty}>该时段暂无数据</div>
          )}
        </div>
      </FormSection>
      <FormButtonGroup>
        <FormButton onClick={onClose}>关闭</FormButton>
      </FormButtonGroup>
    </Modal>
  );
};

export default NoiseReportModal;
