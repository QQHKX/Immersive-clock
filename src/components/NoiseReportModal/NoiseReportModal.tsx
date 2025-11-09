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
const MINI_CHART_HEIGHT = 120;
const MINI_CHART_PADDING = 30;

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

  /**
   * 波动性评分计算（函数级中文注释）：
   * - 目标：减少校准阈值对评价的影响，关注“连续噪音的波动性/变异性”；
   * - 方法：对分贝序列做移动平均平滑，基于相邻差分的平均绝对值与均方根，以及整体标准差综合为“波动指数”；
   * - 归一化：采用经验常量（absDiff≈3dB、rms≈3.5dB、std≈6dB）归一化到 [0,1]；
   * - 评分：score = 100 * (1 - volatilityIndex)，越平滑分数越高；
   * - 额外输出：滚动波动曲线与直方图数据用于下方迷你图展示。
   */
  const volatility = useMemo(() => {
    const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
    if (!period || samplesInPeriod.length < 2) {
      return {
        score: undefined as number | undefined,
        avgAbsDiff: 0,
        rmsDiff: 0,
        stdDev: 0,
        smoothed: [] as number[],
        times: [] as number[],
        rollingDiff: [] as { t: number; v: number }[],
        histogram: [] as { x: number; h: number }[],
      };
    }

    // 提取原始值与时间戳
    const values = samplesInPeriod.map(s => s.v);
    const times = samplesInPeriod.map(s => s.t);

    // 移动平均平滑（窗口 5）
    const k = 5;
    const half = Math.floor(k / 2);
    const smoothed: number[] = values.map((_, i) => {
      const start = Math.max(0, i - half);
      const end = Math.min(values.length - 1, i + half);
      const slice = values.slice(start, end + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      return sum / slice.length;
    });

    // 相邻差分
    const diffs: number[] = smoothed.map((v, i) => (i === 0 ? 0 : Math.abs(v - smoothed[i - 1])));
    const count = Math.max(1, diffs.length - 1);
    const avgAbsDiff = diffs.reduce((a, b) => a + b, 0) / count;
    const rmsDiff = Math.sqrt(diffs.reduce((a, b) => a + b * b, 0) / count);

    // 标准差
    const mean = smoothed.reduce((a, b) => a + b, 0) / smoothed.length;
    const stdDev = Math.sqrt(smoothed.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, smoothed.length));

    // 归一化到 [0,1]，经验常量保证与校准无关
    const normAvg = clamp01(avgAbsDiff / 3);
    const normRms = clamp01(rmsDiff / 3.5);
    const normStd = clamp01(stdDev / 6);
    const volatilityIndex = clamp01(0.6 * normAvg + 0.3 * normRms + 0.1 * normStd);
    const score = Math.round(100 * (1 - volatilityIndex));

    // 滚动波动（窗口 10），用于迷你折线图显示
    const rollW = 10;
    const rollingDiff: { t: number; v: number }[] = smoothed.map((_, i) => {
      const s = Math.max(1, i - rollW + 1);
      const e = i;
      const slice = diffs.slice(s, e + 1);
      const v = slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
      return { t: times[i], v };
    });

    // 直方图（分辨率 4dB），用于分贝分布展示
    const minDb = 0;
    const maxDb = 80;
    const bin = 4;
    const binCount = Math.ceil((maxDb - minDb) / bin);
    const hist = new Array(binCount).fill(0);
    smoothed.forEach(v => {
      const idx = Math.max(0, Math.min(binCount - 1, Math.floor((v - minDb) / bin)));
      hist[idx] += 1;
    });
    const histogram = hist.map((h, i) => ({ x: minDb + i * bin, h }));

    return { score, avgAbsDiff, rmsDiff, stdDev, smoothed, times, rollingDiff, histogram };
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
    const s = volatility.score ?? 0;
    if (s >= 85) return '优秀';
    if (s >= 70) return '良好';
    return '待改进';
  }, [volatility.score]);

  /**
   * 统一展示文本（函数级中文注释）：
   * - 将分数与等级合并为一个“表现”值，示例："85 分（优秀）"；
   * - 当分数不可用时仅显示等级文本，保持简洁。
   */
  const gradeDisplay = useMemo(() => {
    return typeof volatility.score === 'number'
      ? `${volatility.score} 分（${gradeText}）`
      : gradeText;
  }, [volatility.score, gradeText]);

  /**
   * 更多统计计算（函数级中文注释）：
   * - 目的：为“更多统计”区提供实用且直观的图表数据；
   * - 包含：
   *   1) 安静占比圆环图（按吵闹时长与总时长计算百分比）；
   *   2) 分贝箱线图（min/Q1/median/Q3/max，基于平滑后的分贝序列）；
   *   3) 提醒密度条形图（按时间分箱统计阈值触发次数）。
   */
  const extraStats = useMemo(() => {
    const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
    const totalMs = stats.durationMs || (period ? period.end.getTime() - period.start.getTime() : 0);
    const noisyMs = stats.noisyDurationMs;
    const quietPercent = totalMs > 0 ? clamp01((totalMs - noisyMs) / totalMs) : 0;

    const arr = volatility.smoothed.length ? volatility.smoothed.slice().sort((a, b) => a - b) : [];
    const pct = (p: number) => {
      if (!arr.length) return 0;
      const idx = Math.min(arr.length - 1, Math.max(0, Math.round(p * (arr.length - 1))));
      return arr[idx];
    };
    const min = arr.length ? arr[0] : 0;
    const max = arr.length ? arr[arr.length - 1] : 0;
    const q1 = pct(0.25);
    const median = pct(0.5);
    const q3 = pct(0.75);

    // 提醒密度：将阈值上升沿按时间分为 6 桶
    const binCount = 6;
    const bins = new Array(binCount).fill(0);
    if (period && volatility.times.length) {
      const startTs = period.start.getTime();
      const endTs = period.end.getTime();
      const span = Math.max(1, endTs - startTs);
      const threshold = getThreshold();
      for (let i = 1; i < samplesInPeriod.length; i++) {
        const prev = samplesInPeriod[i - 1];
        const cur = samplesInPeriod[i];
        if (prev.v <= threshold && cur.v > threshold) {
          const t = cur.t;
          const idx = Math.min(binCount - 1, Math.max(0, Math.floor(((t - startTs) / span) * binCount)));
          bins[idx] += 1;
        }
      }
    }

    return { quietPercent, min, q1, median, q3, max, alertBins: bins };
  }, [stats.durationMs, stats.noisyDurationMs, period, volatility.smoothed, samplesInPeriod]);

  // 渲染逻辑保持不变，仅数据来源统一
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${period?.name || '晚自习'} 统计报告`}
      maxWidth="xl"
      footer={(
        <FormButtonGroup>
          <FormButton onClick={onClose} variant="primary">关闭</FormButton>
        </FormButtonGroup>
      )}
    >
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
            <div className={styles.statValue}>{gradeDisplay}</div>
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

        {/* 更多统计：保持上部紧凑，将迷你图放在下方两列网格中 */}
        <h4 className={styles.sectionTitle}>更多统计</h4>
        <div className={styles.extraChartsGrid}>
          {/* 迷你图1：滚动波动（相邻差分的移动平均） */}
          <div>
            <div className={styles.miniTitle}>滚动波动（差分均值）</div>
            {volatility.rollingDiff.length ? (
              (() => {
                const width = Math.max(320, Math.floor(chartWidth / 2) - 10);
                const height = MINI_CHART_HEIGHT;
                const padding = MINI_CHART_PADDING;
                const maxV = Math.max(3, Math.max(...volatility.rollingDiff.map(p => p.v)));
                const startTs = volatility.times[0];
                const endTs = volatility.times[volatility.times.length - 1];
                const span = Math.max(1, endTs - startTs);
                const mapX = (t: number) => padding + ((t - startTs) / span) * (width - padding * 2);
                const mapY = (v: number) => height - padding - (v / maxV) * (height - padding * 2);
                const pts = volatility.rollingDiff.map(p => ({ x: mapX(p.t), y: mapY(p.v) }));
                const path = pts.map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`)).join(' ');
                const thresholdY1 = mapY(1);
                const thresholdY2 = mapY(3);
                return (
                  <svg width={width} height={height} className={styles.chart} viewBox={`0 0 ${width} ${height}`}>
                    <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className={styles.axis} />
                    <line x1={padding} y1={padding} x2={padding} y2={height - padding} className={styles.axis} />
                    {/* 阈值参考线：1dB 与 3dB */}
                    <line x1={padding} y1={thresholdY1} x2={width - padding} y2={thresholdY1} className={styles.threshold} />
                    <line x1={padding} y1={thresholdY2} x2={width - padding} y2={thresholdY2} className={styles.threshold} />
                    <path d={path} className={styles.line} />
                  </svg>
                );
              })()
            ) : (
              <div className={styles.empty}>暂无数据</div>
            )}
            <div className={styles.chartCaption}>解释：值越低表示曲线越平稳，连续稳定更利于纪律维持。</div>
          </div>

          {/* 迷你图2：分贝直方图 */}
          <div>
            <div className={styles.miniTitle}>分贝分布（4dB 直方图）</div>
            {volatility.histogram.length ? (
              (() => {
                const width = Math.max(320, Math.floor(chartWidth / 2) - 10);
                const height = MINI_CHART_HEIGHT;
                const padding = MINI_CHART_PADDING;
                const maxH = Math.max(1, Math.max(...volatility.histogram.map(b => b.h)));
                const barW = (width - padding * 2) / volatility.histogram.length;
                const bars = volatility.histogram.map((b, i) => {
                  const x = padding + i * barW;
                  const h = ((b.h) / maxH) * (height - padding * 2);
                  const y = height - padding - h;
                  return <rect key={`b-${i}`} x={x} y={y} width={Math.max(1, barW - 1)} height={h} className={styles.barRect} />;
                });
                return (
                  <svg width={width} height={height} className={styles.chart} viewBox={`0 0 ${width} ${height}`}>
                    <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className={styles.axis} />
                    <line x1={padding} y1={padding} x2={padding} y2={height - padding} className={styles.axis} />
                    {bars}
                  </svg>
                );
              })()
            ) : (
              <div className={styles.empty}>暂无数据</div>
            )}
            <div className={styles.chartCaption}>解释：柱形显示各分贝区间出现的次数，偏低且集中代表环境更稳定。</div>
          </div>

          {/* 迷你图3：安静占比圆环图 */}
          <div>
            <div className={styles.miniTitle}>安静占比（Quiet Ratio）</div>
            {period ? (
              (() => {
                // 与旁边图表对齐：使用同样的宽度与高度
                const width = Math.max(320, Math.floor(chartWidth / 2) - 10);
                const height = 140;
                const cx = width / 2;
                const cy = height / 2;
                const r = Math.min(width, height) / 2 - 10; // 根据较小边计算半径，保持正圆
                const circumference = 2 * Math.PI * r;
                const percent = extraStats.quietPercent;
                const dash = percent * circumference;
                return (
                  <svg width={width} height={height} className={styles.chart} viewBox={`0 0 ${width} ${height}`}>
                    {/* 背景轨道 */}
                    <circle cx={cx} cy={cy} r={r} className={styles.donutTrack} />
                    {/* 数值圈，起点旋转到顶部 */}
                    <g transform={`rotate(-90 ${cx} ${cy})`}>
                      <circle cx={cx} cy={cy} r={r} className={styles.donutValue}
                        strokeDasharray={`${dash} ${circumference - dash}`} />
                    </g>
                    {/* 中心文本 */}
                    <text x={cx} y={cy - 2} textAnchor="middle" className={styles.donutTextMain}>{Math.round(percent * 100)}%</text>
                    <text x={cx} y={cy + 20} textAnchor="middle" className={styles.donutTextSub}>安静时长占比</text>
                  </svg>
                );
              })()
            ) : (
              <div className={styles.empty}>暂无数据</div>
            )}
            <div className={styles.chartCaption}>解释：按时段总时长计算安静时间比例，数值越高纪律越好。</div>
          </div>

          {/* 迷你图4：分贝箱线图（平滑序列） */}
          <div>
            <div className={styles.miniTitle}>分贝箱线图（平滑数据）</div>
            {volatility.smoothed.length ? (
              (() => {
                const width = Math.max(320, Math.floor(chartWidth / 2) - 10);
                const height = 140;
                const padding = 30;
                const minDb = 0;
                const maxDb = 80;
                const mapX = (v: number) => padding + ((v - minDb) / (maxDb - minDb)) * (width - padding * 2);
                const yMid = height / 2;
                const xMin = mapX(extraStats.min);
                const xQ1 = mapX(extraStats.q1);
                const xMedian = mapX(extraStats.median);
                const xQ3 = mapX(extraStats.q3);
                const xMax = mapX(extraStats.max);
                const boxH = 24;
                return (
                  <svg width={width} height={height} className={styles.chart} viewBox={`0 0 ${width} ${height}`}>
                    {/* 轴线 */}
                    <line x1={padding} y1={yMid} x2={width - padding} y2={yMid} className={styles.axis} />
                    {/* 胡须与最值 */}
                    <line x1={xMin} y1={yMid - 12} x2={xMin} y2={yMid + 12} className={styles.boxWhisker} />
                    <line x1={xMax} y1={yMid - 12} x2={xMax} y2={yMid + 12} className={styles.boxWhisker} />
                    <line x1={xMin} y1={yMid} x2={xQ1} y2={yMid} className={styles.boxLine} />
                    <line x1={xQ3} y1={yMid} x2={xMax} y2={yMid} className={styles.boxLine} />
                    {/* 箱体与中位线 */}
                    <rect x={xQ1} y={yMid - boxH / 2} width={Math.max(1, xQ3 - xQ1)} height={boxH} className={styles.boxRect} />
                    <line x1={xMedian} y1={yMid - boxH / 2} x2={xMedian} y2={yMid + boxH / 2} className={styles.boxMedian} />
                    {/* 标签 */}
                    <text x={xMin} y={yMid + boxH} textAnchor="middle" className={styles.tickLabel}>{extraStats.min.toFixed(1)}</text>
                    <text x={xQ1} y={yMid + boxH} textAnchor="middle" className={styles.tickLabel}>{extraStats.q1.toFixed(1)}</text>
                    <text x={xMedian} y={yMid + boxH + 12} textAnchor="middle" className={styles.tickLabel}>{extraStats.median.toFixed(1)}</text>
                    <text x={xQ3} y={yMid + boxH} textAnchor="middle" className={styles.tickLabel}>{extraStats.q3.toFixed(1)}</text>
                    <text x={xMax} y={yMid + boxH} textAnchor="middle" className={styles.tickLabel}>{extraStats.max.toFixed(1)}</text>
                  </svg>
                );
              })()
            ) : (
              <div className={styles.empty}>暂无数据</div>
            )}
            <div className={styles.chartCaption}>解释：箱体越窄代表分贝波动集中，稳定性更好；中位线偏低代表整体更安静。</div>
          </div>

          {/* 迷你图5：提醒密度条形图 */}
          <div>
            <div className={styles.miniTitle}>提醒密度（按时段分箱）</div>
            {period ? (
              (() => {
                const width = Math.max(320, Math.floor(chartWidth / 2) - 10);
                const height = 140;
                const padding = 30;
                const bars = extraStats.alertBins;
                const maxV = Math.max(1, Math.max(...bars));
                const barW = (width - padding * 2) / bars.length;
                const items = bars.map((v, i) => {
                  const x = padding + i * barW;
                  const h = (v / maxV) * (height - padding * 2);
                  const y = height - padding - h;
                  return <rect key={`ad-${i}`} x={x} y={y} width={Math.max(1, barW - 2)} height={h} className={styles.barThin} />;
                });
                return (
                  <svg width={width} height={height} className={styles.chart} viewBox={`0 0 ${width} ${height}`}>
                    <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className={styles.axis} />
                    <line x1={padding} y1={padding} x2={padding} y2={height - padding} className={styles.axis} />
                    {items}
                  </svg>
                );
              })()
            ) : (
              <div className={styles.empty}>暂无数据</div>
            )}
            <div className={styles.chartCaption}>解释：柱形越高表示该时间段提醒更密集，可针对性加强管理。</div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default NoiseReportModal;
