import React, { useMemo, useRef, useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import { FormButton, FormButtonGroup } from '../FormComponents';
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

/**
 * 晚自习统计报告弹窗（函数级注释）：
 * - 展示当前课时的关键统计（时长、表现、峰值、平均、提醒、吵闹时长）；
 * - 使用带坐标轴的折线图显示噪音走势，包含阈值红虚线与面积填充；
 * - 数据来源统一于噪音采样存储，支持外部覆盖样本用于测试。
 */
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
      return { width, height, padding, path: '', thresholdY, xTicks: [] as number[], yTicks: [20, 40, 60, 80] };
    }
    const startTs = period.start.getTime();
    const endTs = period.end.getTime();
    const span = Math.max(1, endTs - startTs);
    const mapX = (t: number) => padding + ((t - startTs) / span) * (width - padding * 2);
    const mapY = (v: number) => height - padding - ((v - minDb) / (maxDb - minDb)) * (height - padding * 2);
    const pts = samplesInPeriod.map(p => ({ x: mapX(p.t), y: mapY(p.v) }));
    const path = pts.map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`)).join(' ');
    const thresholdY = mapY(getThreshold());
    // 构造坐标轴刻度：X 轴均匀 4 个点，Y 轴固定 20/40/60/80
    const xTicks: number[] = [];
    for (let i = 0; i <= 4; i++) {
      xTicks.push(startTs + Math.round((span * i) / 4));
    }
    const yTicks: number[] = [20, 40, 60, 80];
    return { width, height, padding, path, thresholdY, xTicks, yTicks };
  }, [samplesInPeriod, chartWidth, period]);

  // 统计辅助：格式化时长为中文“m分s秒”
  const formatDurationCn = (ms: number) => {
    const sec = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}分${s}秒`;
  };

  // 综合评价：根据提醒次数与吵闹时长给出等级
  const gradeText = useMemo(() => {
    const alerts = stats.transitions;
    const noisySec = Math.round(stats.noisyDurationMs / 1000);
    if (alerts === 0 && noisySec === 0) return '优秀';
    if (alerts <= 2 && noisySec <= 60) return '良好';
    if (alerts <= 5 && noisySec <= 180) return '一般';
    return '需改进';
  }, [stats.transitions, stats.noisyDurationMs]);

  // 渲染逻辑保持不变，仅数据来源统一
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${period?.name || '晚自习'} 统计报告`} maxWidth="xl">
      {/* 单层容器：去除双层 FormSection，保持标题与内容结构 */}
      <div className={styles.singleContainer}>
        <h4 className={styles.sectionTitle}>报告概览</h4>
        <div className={styles.summaryGrid}>
          <div className={styles.statItem}>
            <div className={styles.statLabel}>时长</div>
            <div className={styles.statValue}>{period ? Math.round((period.end.getTime() - period.start.getTime()) / 60000) : 0} 分钟</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statLabel}>表现</div>
            <div className={styles.statValue}>{gradeText}</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statLabel}>峰值</div>
            <div className={styles.statValue}>{stats.max.toFixed(1)} dB</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statLabel}>平均</div>
            <div className={styles.statValue}>{stats.avg.toFixed(1)} dB</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statLabel}>提醒</div>
            <div className={styles.statValue}>{stats.transitions}</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statLabel}>吵闹</div>
            <div className={styles.statValue}>{formatDurationCn(stats.noisyDurationMs)}</div>
          </div>
        </div>

        <h4 className={styles.sectionTitle}>噪音走势</h4>
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

              {/* 坐标轴 */}
              <line x1={chart.padding} y1={chart.height - chart.padding} x2={chart.width - chart.padding} y2={chart.height - chart.padding} className={styles.axis} />
              <line x1={chart.padding} y1={chart.padding} x2={chart.padding} y2={chart.height - chart.padding} className={styles.axis} />

              {/* X 轴刻度与标签 */}
              {chart.xTicks.map((t, idx) => {
                const x = chart.padding + ((t - (period!.start.getTime())) / (period!.end.getTime() - period!.start.getTime())) * (chart.width - chart.padding * 2);
                const label = new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                return (
                  <g key={`xt-${idx}`}>
                    <line x1={x} y1={chart.height - chart.padding} x2={x} y2={chart.height - chart.padding + 6} className={styles.tick} />
                    <text x={x} y={chart.height - chart.padding + 18} textAnchor="middle" className={styles.tickLabel}>{label}</text>
                    {/* 网格线 */}
                    <line x1={x} y1={chart.padding} x2={x} y2={chart.height - chart.padding} className={styles.gridLine} />
                  </g>
                );
              })}

              {/* Y 轴刻度与标签 */}
              {chart.yTicks.map((v, idx) => {
                const y = chart.height - chart.padding - ((v - 0) / (80 - 0)) * (chart.height - chart.padding * 2);
                return (
                  <g key={`yt-${idx}`}>
                    <line x1={chart.padding - 6} y1={y} x2={chart.padding} y2={y} className={styles.tick} />
                    <text x={chart.padding - 10} y={y + 4} textAnchor="end" className={styles.tickLabel}>{v}</text>
                    {/* 网格线 */}
                    <line x1={chart.padding} y1={y} x2={chart.width - chart.padding} y2={y} className={styles.gridLine} />
                  </g>
                );
              })}

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
        <div className={styles.chartHint}>
          统计范围：{period ? `${period.start.toLocaleString()} - ${period.end.toLocaleString()}` : '无'}
        </div>
      </div>
      <FormButtonGroup>
        <FormButton onClick={onClose}>关闭</FormButton>
      </FormButtonGroup>
    </Modal>
  );
};

export default NoiseReportModal;
