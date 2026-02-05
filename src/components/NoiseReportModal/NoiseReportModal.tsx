import React, { useMemo, useRef, useEffect, useState } from "react";

import { getNoiseControlSettings } from "../../utils/noiseControlSettings";
import { readNoiseSamples, subscribeNoiseSamplesUpdated } from "../../utils/noiseDataService";
// 保存逻辑由外部统一入口处理，本弹窗只负责展示
import { FormButton, FormButtonGroup } from "../FormComponents";
import Modal from "../Modal/Modal";

import styles from "./NoiseReportModal.module.css";

export interface NoiseReportPeriod {
  id: string;
  name: string;
  start: Date;
  end: Date;
}

interface NoiseSample {
  t: number; // 时间戳
  v: number; // 音量（dB）
  s: "quiet" | "noisy";
}

export interface NoiseSampleForScore {
  t: number;
  v: number;
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
 * 计算分位数（函数级中文注释）：
 * - 输入需为已排序数组（升序）；
 * - 使用线性插值获得更平滑的分位数结果；
 * - p 取值范围 [0,1]，越大代表越靠近高位。
 */
function quantileSorted(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const pp = Math.max(0, Math.min(1, p));
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * pp;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

/**
 * 计算晚自习“纪律评分”（函数级中文注释）：
 * - 目标：在设备不同/校准偏移/误校准导致整体 dB 平移时，仍保持评分稳定；
 * - 方法：用分布的鲁棒阈值（Tukey 上界）识别“噪音冲击”，并综合冲击占比、冲击次数与冲击强度；
 * - 特性：若所有分贝整体加/减常数，分位数阈值同步平移，超阈判定与超出量基本不变。
 */
export function computeDisciplineScore(
  period: NoiseReportPeriod | null,
  samplesInPeriod: NoiseSampleForScore[]
): {
  score?: number;
  dynThreshold: number;
  impactCount: number;
  impactDurationMs: number;
  impactRatio: number;
  p95: number;
} {
  if (!period || samplesInPeriod.length < 2) {
    return {
      score: undefined,
      dynThreshold: 0,
      impactCount: 0,
      impactDurationMs: 0,
      impactRatio: 0,
      p95: 0,
    };
  }

  const values = samplesInPeriod.map((s) => s.v).filter((v) => Number.isFinite(v));
  if (values.length < 2) {
    return {
      score: undefined,
      dynThreshold: 0,
      impactCount: 0,
      impactDurationMs: 0,
      impactRatio: 0,
      p95: 0,
    };
  }

  const sorted = values.slice().sort((a, b) => a - b);
  const p25 = quantileSorted(sorted, 0.25);
  const p50 = quantileSorted(sorted, 0.5);
  const p75 = quantileSorted(sorted, 0.75);
  const p95 = quantileSorted(sorted, 0.95);
  const iqr = Math.max(1, p75 - p25);
  const upperFence = p75 + 1.5 * iqr;
  const dynThreshold = Math.max(upperFence, p50 + 6);

  const totalDurationMs = Math.max(1, period.end.getTime() - period.start.getTime());
  let impactDurationMs = 0;
  let impactCount = 0;

  for (let i = 1; i < samplesInPeriod.length; i++) {
    const prev = samplesInPeriod[i - 1];
    const cur = samplesInPeriod[i];
    const dt = Math.max(0, cur.t - prev.t);
    const anyImpact = prev.v > dynThreshold || cur.v > dynThreshold;
    if (anyImpact) impactDurationMs += dt;
    const risingEdge = prev.v <= dynThreshold && cur.v > dynThreshold;
    if (risingEdge) impactCount += 1;
  }

  const impactRatio = Math.max(0, Math.min(1, impactDurationMs / totalDurationMs));
  const minutes = totalDurationMs / 60_000;
  const impactPerMin = minutes > 0 ? impactCount / minutes : 0;
  const intensity = Math.max(0, p95 - dynThreshold);

  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  const timePenalty = clamp01(impactRatio / 0.2);
  const countPenalty = clamp01(impactPerMin / 6);
  const intensityPenalty = clamp01(intensity / 10);
  const penalty = 0.5 * timePenalty + 0.3 * countPenalty + 0.2 * intensityPenalty;
  const score = Math.max(0, Math.min(100, Math.round(100 * (1 - penalty))));

  return { score, dynThreshold, impactCount, impactDurationMs, impactRatio, p95 };
}

/**
 * 自习统计报告弹窗（函数级注释）：
 * - 展示当前课时的关键统计（时长、表现、峰值、平均、提醒、吵闹时长）；
 * - 使用带坐标轴的折线图显示噪音走势，包含阈值红虚线与面积填充；
 * - 数据来源统一于噪音采样存储，支持外部覆盖样本用于测试。
 */
export const NoiseReportModal: React.FC<NoiseReportModalProps> = ({
  isOpen,
  onClose,
  period,
  samplesOverride,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(860);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const measure = () => {
      const w = chartContainerRef.current?.clientWidth || 860;
      setChartWidth(w);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, [isOpen]);

  // 当噪音样本更新时，如果弹窗打开则刷新
  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = subscribeNoiseSamplesUpdated(() => setTick((t) => t + 1));
    // 打开后立即触发一次，避免初次为空
    setTick((t) => t + 1);
    return unsubscribe;
  }, [isOpen]);

  const samplesInPeriod = useMemo<NoiseSample[]>(() => {
    void tick;
    if (!period) return [];
    const startTs = period.start.getTime();
    const endTs = period.end.getTime();
    if (samplesOverride && samplesOverride.length) {
      return samplesOverride.filter((item) => item.t >= startTs && item.t <= endTs);
    }
    try {
      const all: NoiseSample[] = readNoiseSamples();
      return all.filter((item) => item.t >= startTs && item.t <= endTs);
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
   * 纪律评分计算结果（函数级中文注释）：
   * - 以“噪音冲击”衡量晚自习纪律：冲击占比、冲击次数与冲击强度；
   * - 使用相对阈值（分位数/上界）降低不同设备与误校准带来的影响。
   */
  const discipline = useMemo(() => {
    return computeDisciplineScore(period, samplesInPeriod);
  }, [period, samplesInPeriod]);

  /**
   * 分贝直方图数据（函数级中文注释）：
   * - 目的：展示该时段分贝值的整体分布，便于快速感知“集中/分散”；\n+   * - 使用 4dB 作为分箱粒度，保持可读性；\n+   * - 数据直接来源于该时段样本，不参与评分计算。
   */
  const histogram = useMemo(() => {
    const values = samplesInPeriod.map((s) => s.v).filter((v) => Number.isFinite(v));
    if (!values.length) return [] as { x: number; h: number }[];

    const minDb = 0;
    const maxDb = 80;
    const bin = 4;
    const binCount = Math.ceil((maxDb - minDb) / bin);
    const hist = new Array(binCount).fill(0);
    values.forEach((v) => {
      const idx = Math.max(0, Math.min(binCount - 1, Math.floor((v - minDb) / bin)));
      hist[idx] += 1;
    });
    return hist.map((h, i) => ({ x: minDb + i * bin, h }));
  }, [samplesInPeriod]);

  // 基于当前时段样本生成 SVG 折线图数据
  const chart = useMemo(() => {
    const width = chartWidth;
    const height = CHART_HEIGHT;
    const padding = CHART_PADDING;
    const minDb = 0;
    const maxDb = 80;
    if (!period || samplesInPeriod.length === 0) {
      const thresholdY =
        height - padding - ((getThreshold() - minDb) / (maxDb - minDb)) * (height - padding * 2);
      return {
        width,
        height,
        padding,
        path: "",
        thresholdY,
        xTicks: [] as number[],
        yTicks: [20, 40, 60, 80],
      };
    }
    const startTs = period.start.getTime();
    const endTs = period.end.getTime();
    const span = Math.max(1, endTs - startTs);
    const mapX = (t: number) => padding + ((t - startTs) / span) * (width - padding * 2);
    const mapY = (v: number) =>
      height - padding - ((v - minDb) / (maxDb - minDb)) * (height - padding * 2);
    const pts = samplesInPeriod.map((p) => ({ x: mapX(p.t), y: mapY(p.v) }));
    const path = pts
      .map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`))
      .join(" ");
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
    const s = discipline.score ?? 0;
    if (s >= 85) return "优秀";
    if (s >= 70) return "良好";
    return "待改进";
  }, [discipline.score]);

  /**
   * 统一展示文本（函数级中文注释）：
   * - 将分数与等级合并为一个“表现”值，示例："85 分（优秀）"；
   * - 当分数不可用时仅显示等级文本，保持简洁。
   */
  const gradeDisplay = useMemo(() => {
    return typeof discipline.score === "number"
      ? `${discipline.score} 分（${gradeText}）`
      : gradeText;
  }, [discipline.score, gradeText]);

  /**
   * 更多统计计算（函数级中文注释）：
   * - 目的：为“更多统计”区提供实用且直观的图表数据；
   * - 包含：
   *   1) 安静占比圆环图（按吵闹时长与总时长计算百分比）；
   *   2) 提醒密度条形图（按时间分箱统计“冲击阈值”上升沿次数）。
   */
  const extraStats = useMemo(() => {
    const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
    const totalMs =
      stats.durationMs || (period ? period.end.getTime() - period.start.getTime() : 0);
    const impactMs = discipline.impactDurationMs;
    const quietPercent = totalMs > 0 ? clamp01((totalMs - impactMs) / totalMs) : 0;

    // 冲击密度：将冲击阈值上升沿按时间分为 6 桶
    const binCount = 6;
    const bins = new Array(binCount).fill(0);
    if (period && discipline.dynThreshold > 0) {
      const startTs = period.start.getTime();
      const endTs = period.end.getTime();
      const span = Math.max(1, endTs - startTs);
      for (let i = 1; i < samplesInPeriod.length; i++) {
        const prev = samplesInPeriod[i - 1];
        const cur = samplesInPeriod[i];
        if (prev.v <= discipline.dynThreshold && cur.v > discipline.dynThreshold) {
          const t = cur.t;
          const idx = Math.min(
            binCount - 1,
            Math.max(0, Math.floor(((t - startTs) / span) * binCount))
          );
          bins[idx] += 1;
        }
      }
    }

    return { quietPercent, impactBins: bins };
  }, [
    stats.durationMs,
    period,
    discipline.dynThreshold,
    discipline.impactDurationMs,
    samplesInPeriod,
  ]);

  // 渲染逻辑保持不变，仅数据来源统一
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${period?.name || "自习"} 统计报告`}
      maxWidth="xl"
      footer={
        <FormButtonGroup>
          <FormButton onClick={onClose} variant="primary">
            关闭
          </FormButton>
        </FormButtonGroup>
      }
    >
      {/* 单层容器：去除双层 FormSection，保持标题与内容结构 */}
      <div className={styles.singleContainer}>
        <h4 className={styles.sectionTitle}>报告概览</h4>
        <div className={styles.summaryGrid}>
          <div className={styles.statItem}>
            <div className={styles.statLabel}>时长</div>
            <div className={styles.statValue}>
              {period ? Math.round((period.end.getTime() - period.start.getTime()) / 60000) : 0}{" "}
              分钟
            </div>
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
            <div className={styles.statLabel}>冲击</div>
            <div className={styles.statValue}>{discipline.impactCount}</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statLabel}>冲击时长</div>
            <div className={styles.statValue}>{formatDurationCn(discipline.impactDurationMs)}</div>
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
                <linearGradient
                  id="reportAreaGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2={chart.height}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="#03DAC6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#03DAC6" stopOpacity={0} />
                </linearGradient>
              </defs>

              {/* 坐标轴 */}
              <line
                x1={chart.padding}
                y1={chart.height - chart.padding}
                x2={chart.width - chart.padding}
                y2={chart.height - chart.padding}
                className={styles.axis}
              />
              <line
                x1={chart.padding}
                y1={chart.padding}
                x2={chart.padding}
                y2={chart.height - chart.padding}
                className={styles.axis}
              />

              {/* X 轴刻度与标签 */}
              {chart.xTicks.map((t, idx) => {
                const x =
                  chart.padding +
                  ((t - period!.start.getTime()) /
                    (period!.end.getTime() - period!.start.getTime())) *
                    (chart.width - chart.padding * 2);
                const label = new Date(t).toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <g key={`xt-${idx}`}>
                    <line
                      x1={x}
                      y1={chart.height - chart.padding}
                      x2={x}
                      y2={chart.height - chart.padding + 6}
                      className={styles.tick}
                    />
                    <text
                      x={x}
                      y={chart.height - chart.padding + 18}
                      textAnchor="middle"
                      className={styles.tickLabel}
                    >
                      {label}
                    </text>
                    {/* 网格线 */}
                    <line
                      x1={x}
                      y1={chart.padding}
                      x2={x}
                      y2={chart.height - chart.padding}
                      className={styles.gridLine}
                    />
                  </g>
                );
              })}

              {/* Y 轴刻度与标签 */}
              {chart.yTicks.map((v, idx) => {
                const y =
                  chart.height -
                  chart.padding -
                  ((v - 0) / (80 - 0)) * (chart.height - chart.padding * 2);
                return (
                  <g key={`yt-${idx}`}>
                    <line
                      x1={chart.padding - 6}
                      y1={y}
                      x2={chart.padding}
                      y2={y}
                      className={styles.tick}
                    />
                    <text
                      x={chart.padding - 10}
                      y={y + 4}
                      textAnchor="end"
                      className={styles.tickLabel}
                    >
                      {v}
                    </text>
                    {/* 网格线 */}
                    <line
                      x1={chart.padding}
                      y1={y}
                      x2={chart.width - chart.padding}
                      y2={y}
                      className={styles.gridLine}
                    />
                  </g>
                );
              })}

              {/* 阈值线 */}
              <line
                x1={chart.padding}
                y1={chart.thresholdY}
                x2={chart.width - chart.padding}
                y2={chart.thresholdY}
                className={styles.threshold}
              />
              {/* 折线 */}
              <path d={chart.path} className={styles.line} />
              {/* 面积填充 */}
              <path
                d={`${chart.path} L ${chart.width - chart.padding} ${chart.height - chart.padding} L ${chart.padding} ${chart.height - chart.padding} Z`}
                fill="url(#reportAreaGradient)"
                className={styles.area}
              />
            </svg>
          ) : (
            <div className={styles.empty}>该时段暂无数据</div>
          )}
        </div>
        <div className={styles.chartHint}>
          统计范围：
          {period ? `${period.start.toLocaleString()} - ${period.end.toLocaleString()}` : "无"}
          {typeof discipline.score === "number" && discipline.dynThreshold > 0
            ? `；评分参考阈值（相对）：${discipline.dynThreshold.toFixed(1)} dB`
            : ""}
        </div>

        {/* 更多统计：保持上部紧凑，将迷你图放在下方两列网格中 */}
        <h4 className={styles.sectionTitle}>更多统计</h4>
        <div className={styles.extraChartsGrid}>
          {/* 迷你图2：分贝直方图 */}
          <div>
            <div className={styles.miniTitle}>分贝分布（4dB 直方图）</div>
            {histogram.length ? (
              (() => {
                const width = Math.max(320, Math.floor(chartWidth / 2) - 10);
                const height = MINI_CHART_HEIGHT;
                const padding = MINI_CHART_PADDING;
                const maxH = Math.max(1, Math.max(...histogram.map((b) => b.h)));
                const barW = (width - padding * 2) / histogram.length;
                const bars = histogram.map((b, i) => {
                  const x = padding + i * barW;
                  const h = (b.h / maxH) * (height - padding * 2);
                  const y = height - padding - h;
                  return (
                    <rect
                      key={`b-${i}`}
                      x={x}
                      y={y}
                      width={Math.max(1, barW - 1)}
                      height={h}
                      className={styles.barRect}
                    />
                  );
                });
                return (
                  <svg
                    width={width}
                    height={height}
                    className={styles.chart}
                    viewBox={`0 0 ${width} ${height}`}
                  >
                    <line
                      x1={padding}
                      y1={height - padding}
                      x2={width - padding}
                      y2={height - padding}
                      className={styles.axis}
                    />
                    <line
                      x1={padding}
                      y1={padding}
                      x2={padding}
                      y2={height - padding}
                      className={styles.axis}
                    />
                    {bars}
                  </svg>
                );
              })()
            ) : (
              <div className={styles.empty}>暂无数据</div>
            )}
            <div className={styles.chartCaption}>
              解释：柱形显示各分贝区间出现的次数，偏低且集中代表环境更稳定。
            </div>
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
                  <svg
                    width={width}
                    height={height}
                    className={styles.chart}
                    viewBox={`0 0 ${width} ${height}`}
                  >
                    {/* 背景轨道 */}
                    <circle cx={cx} cy={cy} r={r} className={styles.donutTrack} />
                    {/* 数值圈，起点旋转到顶部 */}
                    <g transform={`rotate(-90 ${cx} ${cy})`}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        className={styles.donutValue}
                        strokeDasharray={`${dash} ${circumference - dash}`}
                      />
                    </g>
                    {/* 中心文本 */}
                    <text x={cx} y={cy - 2} textAnchor="middle" className={styles.donutTextMain}>
                      {Math.round(percent * 100)}%
                    </text>
                    <text x={cx} y={cy + 20} textAnchor="middle" className={styles.donutTextSub}>
                      安静时长占比
                    </text>
                  </svg>
                );
              })()
            ) : (
              <div className={styles.empty}>暂无数据</div>
            )}
            <div className={styles.chartCaption}>
              解释：按时段总时长计算安静时间比例，数值越高纪律越好。
            </div>
          </div>

          {/* 迷你图4：冲击密度条形图 */}
          <div>
            <div className={styles.miniTitle}>冲击密度（按时段分箱）</div>
            {period ? (
              (() => {
                const width = Math.max(320, Math.floor(chartWidth / 2) - 10);
                const height = 140;
                const padding = 30;
                const bars = extraStats.impactBins;
                const maxV = Math.max(1, Math.max(...bars));
                const barW = (width - padding * 2) / bars.length;
                const items = bars.map((v, i) => {
                  const x = padding + i * barW;
                  const h = (v / maxV) * (height - padding * 2);
                  const y = height - padding - h;
                  return (
                    <rect
                      key={`ad-${i}`}
                      x={x}
                      y={y}
                      width={Math.max(1, barW - 2)}
                      height={h}
                      className={styles.barThin}
                    />
                  );
                });
                return (
                  <svg
                    width={width}
                    height={height}
                    className={styles.chart}
                    viewBox={`0 0 ${width} ${height}`}
                  >
                    <line
                      x1={padding}
                      y1={height - padding}
                      x2={width - padding}
                      y2={height - padding}
                      className={styles.axis}
                    />
                    <line
                      x1={padding}
                      y1={padding}
                      x2={padding}
                      y2={height - padding}
                      className={styles.axis}
                    />
                    {items}
                  </svg>
                );
              })()
            ) : (
              <div className={styles.empty}>暂无数据</div>
            )}
            <div className={styles.chartCaption}>
              解释：柱形越高表示该时间段噪音冲击更密集，可针对性加强管理。
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default NoiseReportModal;
