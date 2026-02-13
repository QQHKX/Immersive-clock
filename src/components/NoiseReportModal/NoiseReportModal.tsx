import React, { useEffect, useMemo, useRef, useState } from "react";

import { getNoiseControlSettings } from "../../utils/noiseControlSettings";
import { readNoiseSlices, subscribeNoiseSlicesUpdated } from "../../utils/noiseSliceService";
import { FormButton, FormSection } from "../FormComponents";
import Modal from "../Modal/Modal";

import styles from "./NoiseReportModal.module.css";

export interface NoiseReportPeriod {
  id: string;
  name: string;
  start: Date;
  end: Date;
}

interface NoiseReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  period: NoiseReportPeriod | null;
}

const CHART_HEIGHT = 140;
const SMALL_CHART_HEIGHT = 100;
const CHART_PADDING = 24;

/**
 * 数字滚动组件
 * @param value 目标数值
 * @param duration 动画持续时间
 * @param delay 动画延迟
 * @param decimals 小数位数
 * @param suffix 后缀
 * @param formatter 自定义格式化函数
 */
const NumberTicker: React.FC<{
  value: number;
  duration?: number;
  delay?: number;
  decimals?: number;
  suffix?: string;
  formatter?: (v: number) => string;
}> = ({ value, duration = 1000, delay = 0, decimals = 0, suffix = "", formatter }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const progress = Math.min((time - startTimeRef.current) / duration, 1);

      // 三次缓出效果
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const current = progress === 1 ? value : value * easeProgress;
      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    timeoutId = setTimeout(() => {
      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, delay]);

  const formatted = formatter
    ? formatter(displayValue)
    : displayValue.toFixed(decimals) + suffix;

  return <span>{formatted}</span>;
};

/**
 * 格式化持续时间
 * @param ms 毫秒数
 */
function formatDuration(ms: number) {
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}分${s}秒`;
}

/**
 * 格式化分钟
 * @param ms 毫秒数
 */
function formatMinutes(ms: number) {
  const m = Math.round(ms / 60_000);
  return `${m} 分钟`;
}

/**
 * 格式化时间为 HH:MM
 * @param d 日期对象
 */
function formatTimeHHMM(d: Date) {
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

/**
 * 获取得分等级文本
 * @param score 分数
 */
function getScoreLevelText(score: number) {
  if (score >= 90) return "优秀";
  if (score >= 75) return "良好";
  if (score >= 60) return "一般";
  return "较差";
}

/**
 * 噪音统计报告弹窗组件
 */
export const NoiseReportModal: React.FC<NoiseReportModalProps> = ({ isOpen, onClose, period }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const moreStatsRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(860);
  const [isGridSingleColumn, setIsGridSingleColumn] = useState(false);
  const [tick, setTick] = useState(0);

  // 动画状态
  const [isLoaded, setIsLoaded] = useState(false);
  const [showMainChart, setShowMainChart] = useState(false);
  const [showMoreStats, setShowMoreStats] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // 开启时重置动画状态
      setIsLoaded(false);
      setShowMainChart(false);
      setShowMoreStats(false);

      // 延迟触发概览动画
      const t1 = setTimeout(() => setIsLoaded(true), 100);
      // 延迟触发主图表动画
      const t2 = setTimeout(() => setShowMainChart(true), 900);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !moreStatsRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShowMoreStats(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(moreStatsRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  useEffect(() => {
    const measure = () => {
      const w = chartContainerRef.current?.clientWidth || 860;
      setChartWidth(w);
      setIsGridSingleColumn(window.innerWidth <= 768);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = subscribeNoiseSlicesUpdated(() => setTick((t) => t + 1));
    setTick((t) => t + 1);
    return unsubscribe;
  }, [isOpen]);

  const periodDurationMs = useMemo(() => {
    if (!period) return 0;
    return Math.max(0, period.end.getTime() - period.start.getTime());
  }, [period]);

  const report = useMemo(() => {
    void tick;
    if (!period) return null;
    const startTs = period.start.getTime();
    const endTs = period.end.getTime();
    const thresholdDb = getNoiseControlSettings().maxLevelDb;

    const slices = readNoiseSlices()
      .filter((s) => s.end >= startTs && s.start <= endTs)
      .sort((a, b) => a.start - b.start);

    let totalMs = 0;
    let sumAvgDb = 0;
    let maxDb = -Infinity;
    let sumScore = 0;
    let overDurationMs = 0;
    let segmentCount = 0;
    let sumP50 = 0;
    let sumP95 = 0;
    let sumSustainedPenalty = 0;
    let sumTimePenalty = 0;
    let sumSegmentPenalty = 0;

    const distribution = {
      quiet: 0, // < 45
      normal: 0, // 45-60
      loud: 0, // 60-75
      severe: 0, // > 75
    };

    // 适配暗色主题的调色盘
    const COLORS = {
      quiet: "#81C784", // 绿色 - 安静
      normal: "#64B5F6", // 蓝色 - 正常
      loud: "#FFB74D", // 橙色 - 吵闹
      severe: "#E57373", // 红色 - 极吵
      sustained: "#FFD54F", // 琥珀色
      time: "#FF8A65", // 深橙色
      segment: "#F06292", // 粉色
      score: "#BA68C8", // 紫色
      event: "#E57373", // 红色
    };

    const series: { t: number; v: number; score: number; events: number }[] = [];

    for (const s of slices) {
      const overlapStart = Math.max(startTs, s.start);
      const overlapEnd = Math.min(endTs, s.end);
      const overlapMs = overlapEnd - overlapStart;
      const sliceMs = Math.max(1, s.end - s.start);
      if (overlapMs <= 0) continue;

      const ratio = overlapMs / sliceMs;
      totalMs += overlapMs;
      sumAvgDb += s.display.avgDb * overlapMs;
      sumScore += s.score * overlapMs;
      sumP50 += s.raw.p50Dbfs * overlapMs;
      sumP95 += s.raw.p95Dbfs * overlapMs;
      if (s.display.p95Db > maxDb) maxDb = s.display.p95Db;

      overDurationMs += s.raw.overRatioDbfs * overlapMs;
      segmentCount += Math.round(s.raw.segmentCount * ratio);

      sumSustainedPenalty += s.scoreDetail.sustainedPenalty * overlapMs;
      sumTimePenalty += s.scoreDetail.timePenalty * overlapMs;
      sumSegmentPenalty += s.scoreDetail.segmentPenalty * overlapMs;

      // 分布统计
      const db = s.display.avgDb;
      if (db < 45) distribution.quiet += overlapMs;
      else if (db < 60) distribution.normal += overlapMs;
      else if (db < 75) distribution.loud += overlapMs;
      else distribution.severe += overlapMs;

      series.push({
        t: Math.min(Math.max(s.end, startTs), endTs),
        v: s.display.avgDb,
        score: s.score,
        events: s.raw.segmentCount,
      });
    }

    const avgDb = totalMs > 0 ? sumAvgDb / totalMs : 0;
    const avgScore = totalMs > 0 ? sumScore / totalMs : 0;
    const p50Dbfs = totalMs > 0 ? sumP50 / totalMs : 0;
    const p95Dbfs = totalMs > 0 ? sumP95 / totalMs : 0;
    const sustainedPenalty = totalMs > 0 ? sumSustainedPenalty / totalMs : 0;
    const timePenalty = totalMs > 0 ? sumTimePenalty / totalMs : 0;
    const segmentPenalty = totalMs > 0 ? sumSegmentPenalty / totalMs : 0;

    const scoreText =
      avgScore >= 90
        ? "整体纪律良好，环境稳定。"
        : avgScore >= 70
          ? "整体尚可，存在一定噪音干扰。"
          : "纪律偏弱，建议关注持续吵闹与频繁事件段。";

    return {
      thresholdDb,
      totalMs,
      avgDb,
      maxDb: maxDb === -Infinity ? 0 : maxDb,
      avgScore,
      overDurationMs,
      segmentCount,
      p50Dbfs,
      p95Dbfs,
      sustainedPenalty,
      timePenalty,
      segmentPenalty,
      distribution:
        totalMs > 0
          ? {
            quiet: distribution.quiet / totalMs,
            normal: distribution.normal / totalMs,
            loud: distribution.loud / totalMs,
            severe: distribution.severe / totalMs,
          }
          : { quiet: 0, normal: 0, loud: 0, severe: 0 },
      series,
      scoreText,
      COLORS,
    };
  }, [period, tick]);

  const chart = useMemo(() => {
    const width = chartWidth;
    const height = CHART_HEIGHT;
    const padding = CHART_PADDING;

    if (!period || !report || report.series.length < 2) {
      return {
        width,
        height,
        padding,
        path: "",
        areaPath: "",
        scorePath: "",
        pts: [] as { x: number; y: number; scoreY: number; events: number }[],
        xTicks: [] as { x: number; label: string }[],
        yTicks: [] as { y: number; label: string }[],
        thresholdY: 0,
        mapX: (t: number) => 0,
        mapY: (v: number) => 0,
      };
    }

    const minDb = 0;
    const maxDb = 80;
    const startTs = period.start.getTime();
    const endTs = period.end.getTime();
    const span = Math.max(1, endTs - startTs);
    const mapX = (t: number) => padding + ((t - startTs) / span) * (width - padding * 2);
    const mapY = (v: number) =>
      height - padding - ((v - minDb) / (maxDb - minDb)) * (height - padding * 2);

    const pts = report.series
      .slice()
      .sort((a, b) => a.t - b.t)
      .map((p) => ({
        x: mapX(p.t),
        y: mapY(p.v),
        scoreY: mapY(p.score * 0.8), // 将 0-100 的评分缩放到 0-80 范围以保持视觉一致性
        events: p.events,
      }));

    const path = pts
      .map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`))
      .join(" ");
    const areaPath = `${path} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;

    const scorePath = pts
      .map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.scoreY}` : `L ${pt.x} ${pt.scoreY}`))
      .join(" ");

    const xTickTs = [startTs, startTs + span / 3, startTs + (span * 2) / 3, endTs].map((t) =>
      Math.round(t)
    );
    const xTicks = xTickTs.map((t) => ({
      x: mapX(t),
      label: formatTimeHHMM(new Date(t)),
    }));
    const yTickVals = [20, 40, 60, 80];
    const yTicks = yTickVals.map((v) => ({
      y: mapY(v),
      label: String(v),
    }));
    const thresholdY = mapY(report.thresholdDb);

    return {
      width,
      height,
      padding,
      path,
      areaPath,
      scorePath,
      pts,
      xTicks,
      yTicks,
      thresholdY,
      mapX,
      mapY,
    };
  }, [period, report, chartWidth]);

  const smallChart = useMemo(() => {
    // 确定网格中小图表的宽度
    const containerPadding = 24;
    const gridGap = 12;

    // 移动端单列显示，否则双列
    const width = isGridSingleColumn
      ? chartWidth - containerPadding
      : (chartWidth - gridGap) / 2 - containerPadding;

    const height = SMALL_CHART_HEIGHT;
    const padding = CHART_PADDING;

    if (!period || !report || report.series.length < 2) {
      return {
        width,
        height,
        padding,
        scorePath: "",
        pts: [] as { x: number; y: number; scoreY: number; events: number }[],
        xTicks: [] as { x: number; label: string }[],
        yTicks: [] as { y: number; label: string }[],
        mapX: (t: number) => 0,
        mapY: (v: number) => 0,
      };
    }

    const minDb = 0;
    const maxDb = 80;
    const startTs = period.start.getTime();
    const endTs = period.end.getTime();
    const span = Math.max(1, endTs - startTs);
    const mapX = (t: number) => padding + ((t - startTs) / span) * (width - padding * 2);
    const mapY = (v: number) =>
      height - padding - ((v - minDb) / (maxDb - minDb)) * (height - padding * 2);

    const pts = report.series
      .slice()
      .sort((a, b) => a.t - b.t)
      .map((p) => ({
        x: mapX(p.t),
        y: mapY(p.v),
        scoreY: mapY(p.score * 0.8),
        events: p.events,
      }));

    const scorePath = pts
      .map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.scoreY}` : `L ${pt.x} ${pt.scoreY}`))
      .join(" ");

    // 小图表使用较少的刻度
    const xTickTs = [startTs, endTs].map((t) => Math.round(t));
    const xTicks = xTickTs.map((t) => ({
      x: mapX(t),
      label: formatTimeHHMM(new Date(t)),
    }));

    const yTickVals = [20, 40, 60, 80];
    const yTicks = yTickVals.map((v) => ({
      y: mapY(v),
      label: String(v),
    }));

    return {
      width,
      height,
      padding,
      scorePath,
      pts,
      xTicks,
      yTicks,
      mapX,
      mapY,
    };
  }, [period, report, chartWidth, isGridSingleColumn]);

  const scoreInfo = useMemo(() => {
    if (!report) return null;
    const s = Math.round(report.avgScore);
    return { score: s, level: getScoreLevelText(s) };
  }, [report]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={period ? `${period.name} 统计报告` : "统计报告"}
      maxWidth="xxl"
      footer={
        <div className={styles.footer}>
          <FormButton variant="primary" size="sm" onClick={onClose}>
            返回
          </FormButton>
        </div>
      }
    >
      <div className={styles.container}>
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>报告概览</h4>
          <div className={styles.overviewGrid}>
            <div className={`${styles.card} ${isLoaded ? styles.animateEnter : ""}`} style={{ opacity: 0 }}>
              <div className={styles.cardLabel}>时长</div>
              <div className={styles.cardValue}>
                {period ? formatMinutes(periodDurationMs) : "—"}
              </div>
            </div>
            <div className={`${styles.card} ${isLoaded ? styles.animateEnter : ""}`} style={{ opacity: 0 }}>
              <div className={styles.cardLabel}>表现</div>
              <div className={styles.cardValue}>
                {scoreInfo ? (
                  <>
                    <NumberTicker value={scoreInfo.score} duration={2000} /> 分
                  </>
                ) : (
                  "—"
                )}
                {scoreInfo ? <span className={styles.cardSub}>（{scoreInfo.level}）</span> : null}
              </div>
            </div>
            <div className={`${styles.card} ${isLoaded ? styles.animateEnter : ""}`} style={{ opacity: 0 }}>
              <div className={styles.cardLabel}>峰值</div>
              <div className={styles.cardValue}>
                {report ? (
                  <>
                    <NumberTicker value={report.maxDb} decimals={1} duration={1800} /> dB
                  </>
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div className={`${styles.card} ${isLoaded ? styles.animateEnter : ""}`} style={{ opacity: 0 }}>
              <div className={styles.cardLabel}>平均</div>
              <div className={styles.cardValue}>
                {report ? (
                  <>
                    <NumberTicker value={report.avgDb} decimals={1} duration={1800} /> dB
                  </>
                ) : (
                  "—"
                )}
              </div>
            </div>
            <div className={`${styles.card} ${isLoaded ? styles.animateEnter : ""}`} style={{ opacity: 0 }}>
              <div className={styles.cardLabel}>超阈时长</div>
              <div className={styles.cardValue}>
                {report ? formatDuration(report.overDurationMs) : "—"}
              </div>
            </div>
            <div className={`${styles.card} ${isLoaded ? styles.animateEnter : ""}`} style={{ opacity: 0 }}>
              <div className={styles.cardLabel}>打断次数</div>
              <div className={styles.cardValue}>
                {report ? <NumberTicker value={report.segmentCount} duration={750} /> : "—"}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>噪音走势</h4>
          {report && report.series.length >= 2 ? (
            <div>
              <div ref={chartContainerRef} className={styles.chartWrap}>
                <svg
                  width={chart.width}
                  height={chart.height}
                  className={styles.chart}
                  viewBox={`0 0 ${chart.width} ${chart.height}`}
                  style={
                    {
                      "--path-length": chart.width * 2,
                    } as React.CSSProperties
                  }
                >
                  <defs>
                    <linearGradient
                      id="noiseAreaGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2={chart.height}
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0%" stopColor="#03DAC6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#03DAC6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="noiseAreaGradientWarning"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2={chart.height}
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0%" stopColor={report.COLORS.severe} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={report.COLORS.severe} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="lineGradient" gradientUnits="userSpaceOnUse">
                      {chart.pts.map((p, i) => (
                        <stop
                          key={i}
                          offset={`${(i / (chart.pts.length - 1)) * 100}%`}
                          stopColor={p.y < chart.thresholdY ? report.COLORS.severe : "#03DAC6"}
                        />
                      ))}
                    </linearGradient>
                  </defs>

                  {chart.yTicks.map((t) => (
                    <g key={`y-${t.label}`}>
                      <line
                        x1={chart.padding}
                        x2={chart.width - chart.padding}
                        y1={t.y}
                        y2={t.y}
                        className={styles.gridLine}
                      />
                      <text
                        x={chart.padding - 8}
                        y={t.y + 4}
                        textAnchor="end"
                        className={styles.axisLabel}
                      >
                        {t.label}
                      </text>
                    </g>
                  ))}

                  <line
                    x1={chart.padding}
                    y1={chart.thresholdY}
                    x2={chart.width - chart.padding}
                    y2={chart.thresholdY}
                    className={styles.threshold}
                  />

                  <path
                    d={chart.path}
                    className={`${styles.line} ${showMainChart ? styles.animatePath : ""}`}
                    stroke="url(#lineGradient)"
                    style={{
                      stroke: "url(#lineGradient)",
                      strokeDasharray: "var(--path-length)",
                      strokeDashoffset: showMainChart ? "var(--path-length)" : "var(--path-length)",
                      visibility: showMainChart ? "visible" : "hidden"
                    }}
                  />
                  {/* Base area (normal) */}
                  <mask id="normalMask">
                    <rect
                      x="0"
                      y={chart.thresholdY}
                      width={chart.width}
                      height={chart.height}
                      fill="white"
                    />
                  </mask>
                  {/* Warning area (loud) */}
                  <mask id="warningMask">
                    <rect x="0" y="0" width={chart.width} height={chart.thresholdY} fill="white" />
                  </mask>

                  <g className={showMainChart ? styles.animateArea : ""} style={{ opacity: 0 }}>
                    <path
                      d={chart.areaPath}
                      fill="url(#noiseAreaGradient)"
                      className={styles.area}
                      mask="url(#normalMask)"
                    />
                    <path
                      d={chart.areaPath}
                      fill="url(#noiseAreaGradientWarning)"
                      className={styles.area}
                      mask="url(#warningMask)"
                    />
                  </g>

                  {chart.xTicks.map((t, idx) => (
                    <text
                      key={`x-${idx}`}
                      x={t.x}
                      y={chart.height - 10}
                      textAnchor={
                        idx === 0 ? "start" : idx === chart.xTicks.length - 1 ? "end" : "middle"
                      }
                      className={styles.axisLabel}
                    >
                      {t.label}
                    </text>
                  ))}
                </svg>
              </div>

              <div className={styles.rangeText}>
                统计范围：
                {period ? `${period.start.toLocaleString()} - ${period.end.toLocaleString()}` : "—"}
                ； 噪音报警阈值：{report.thresholdDb.toFixed(1)} dB
              </div>
            </div>
          ) : (
            <div className={styles.empty}>该时段暂无切片数据</div>
          )}
        </div>

        <div className={styles.section} ref={moreStatsRef}>
          <h4 className={styles.sectionTitle}>更多统计</h4>
          {report ? (
            <div className={styles.chartGrid}>
              <div className={styles.chartContainer}>
                <div className={styles.chartTitle}>评分走势 (0-100)</div>
                <svg
                  width={smallChart.width}
                  height={smallChart.height}
                  viewBox={`0 0 ${smallChart.width} ${smallChart.height}`}
                  style={
                    {
                      "--path-length": smallChart.width * 3, // Increase path length to ensure full coverage
                    } as React.CSSProperties
                  }
                >
                  {/* Reuse grid lines */}
                  {smallChart.yTicks.map((t) => (
                    <line
                      key={`sy-${t.label}`}
                      x1={smallChart.padding}
                      x2={smallChart.width - smallChart.padding}
                      y1={t.y}
                      y2={t.y}
                      className={styles.gridLine}
                    />
                  ))}
                  {/* Score Path */}
                  <path
                    d={smallChart.scorePath}
                    fill="none"
                    stroke={report.COLORS.score}
                    strokeWidth="2"
                    opacity={0.9}
                    className={showMoreStats ? styles.animatePath : ""}
                    style={{
                      strokeDasharray: "var(--path-length)",
                      strokeDashoffset: showMoreStats ? "var(--path-length)" : "var(--path-length)", // Always hide initially
                      visibility: showMoreStats ? "visible" : "hidden" // Ensure hidden until animation starts
                    }}
                  />

                  {/* Axis Labels */}
                  {smallChart.xTicks.map((t, idx) => (
                    <text
                      key={`sx-${idx}`}
                      x={t.x}
                      y={smallChart.height - 10}
                      textAnchor={
                        idx === 0 ? "start" : idx === smallChart.xTicks.length - 1 ? "end" : "middle"
                      }
                      className={styles.axisLabel}
                    >
                      {t.label}
                    </text>
                  ))}
                </svg>
              </div>

              <div className={styles.chartContainer}>
                <div className={styles.chartTitle}>打断次数密度 (次/分)</div>
                <svg
                  width={smallChart.width}
                  height={smallChart.height}
                  viewBox={`0 0 ${smallChart.width} ${smallChart.height}`}
                >
                  {smallChart.yTicks.map((t) => (
                    <line
                      key={`ey-${t.label}`}
                      x1={smallChart.padding}
                      x2={smallChart.width - smallChart.padding}
                      y1={t.y}
                      y2={t.y}
                      className={styles.gridLine}
                    />
                  ))}

                  {/* Event Bars */}
                  {smallChart.pts.map((p, i) => {
                    // map event count (0-20) to height
                    const barHeight = (p.events / 20) * (smallChart.height - smallChart.padding * 2);
                    const y = smallChart.height - smallChart.padding - barHeight;
                    // width depends on total points
                    const barWidth = (smallChart.width - smallChart.padding * 2) / smallChart.pts.length;

                    // Calculate staggered delay based on total duration (6s) spread across all points
                    // We want the wave to travel from left to right over ~6 seconds
                    // To sync exactly with the line chart (which takes 4.5s to complete), 
                    // the last bar should START animation slightly before 4.5s so it finishes around 4.5s.
                    // Or more simply, let's make the wave propagation take roughly 4.05s so the visual "front" matches.
                    const totalDuration = 4.05;
                    const progress = i / Math.max(1, smallChart.pts.length - 1);

                    // Apply cubic-bezier(0.25, 0.46, 0.45, 0.94) easing manually
                    // Simplified cubic-bezier implementation for 1D time mapping
                    // This approximates the CSS animation curve so the bars appear to follow the line drawing head
                    const t = progress;
                    const p0 = 0, p1 = 0.25, p2 = 0.45, p3 = 1; // x-coordinates of control points
                    // Since we want time-to-time mapping, we can just use the progress directly if we assume linear traversal,
                    // BUT the CSS animation slows down at start and end. 
                    // To match the visual position of the line head, the delay needs to be the INVERSE of the easing function?
                    // No, the line animation progress is: current_position = easing(current_time / total_time) * total_length
                    // So for a bar at position P (0..1), we want to find time T such that easing(T) = P.
                    // Then delay = T * total_time.

                    // Inverse cubic-bezier is hard to solve analytically. Let's approximate.
                    // The CSS curve (0.25, 0.46, 0.45, 0.94) starts slow, speeds up, then slows down.
                    // So the line head stays at start longer, moves fast in middle, stays at end longer.
                    // Therefore, bars at start need MORE delay relative to linear, bars in middle LESS delay?
                    // Wait, if line is slow at start, it takes LONGER to reach 10%. So bar at 10% should have LARGER delay.
                    // So we need T = inverse_easing(P).

                    // Let's use a simple approximation for the inverse of that specific bezier.
                    // It's roughly linear in middle but steeper at ends.
                    // Actually, let's just use a simple power curve to approximate the delay distribution if exact inverse is too complex.
                    // Or, we can use Newton's method to solve for T given P for cubic bezier.

                    // Cubic Bezier function for X component (time in CSS)
                    // B(t) = (1-t)^3*P0 + 3(1-t)^2*t*P1 + 3(1-t)*t^2*P2 + t^3*P3
                    // Here we need to solve for t where B_y(t) = progress (since CSS animates offset based on Y-curve value over time X)
                    // CSS timing function defines y(x). We want x such that y(x) = P.
                    // Bezier points for ease: (0,0), (0.25, 0.46), (0.45, 0.94), (1,1)
                    // x coords: 0, 0.25, 0.45, 1
                    // y coords: 0, 0.46, 0.94, 1  <-- wait, standard css cubic-bezier(x1, y1, x2, y2) defines P1 and P2. P0=(0,0), P3=(1,1).
                    // So P1=(0.25, 0.46), P2=(0.45, 0.94).
                    // The animation progress output (0..1) is Y at time X.
                    // We want to find time X such that Y(X) = bar_position_percentage.

                    // Let's approximate T such that Y(T) ≈ progress.
                    // Since solving cubic is expensive in render loop, let's pre-calculate or use a look-up if possible.
                    // For now, let's use a iterative approximation (Newton-Raphson) for 3-4 steps.

                    let guessT = progress; // Initial guess
                    for (let j = 0; j < 4; j++) {
                      const t = guessT;
                      const invT = 1 - t;
                      // Y coordinate of cubic bezier at t
                      // y(t) = 3*invT^2*t*0.46 + 3*invT*t^2*0.94 + t^3
                      const y = 3 * invT * invT * t * 0.46 + 3 * invT * t * t * 0.94 + t * t * t;

                      // Derivative dy/dt
                      // y'(t) = ... complex.
                      // Let's just use simple bisection or binary search for stability and simplicity.
                      // Binary search is safer.

                      // Wait, simpler approach:
                      // The delay should match the time when the line head reaches this x-position.
                      // Time T is what we need. CSS animation maps Time T -> Progress Y.
                      // So we need T such that Bezier(T) = BarPosition.
                    }

                    // Binary search for T
                    let low = 0, high = 1;
                    let solvedT = progress;
                    for (let k = 0; k < 8; k++) {
                      const mid = (low + high) / 2;
                      const t = mid;
                      const invT = 1 - t;
                      const y = 3 * invT * invT * t * 0.46 + 3 * invT * t * t * 0.94 + t * t * t;
                      if (y < progress) low = mid;
                      else high = mid;
                      solvedT = mid;
                    }

                    const delay = solvedT * totalDuration;

                    return (
                      <rect
                        key={i}
                        x={p.x - barWidth / 2}
                        y={y}
                        width={Math.max(1, barWidth - 1)}
                        height={barHeight}
                        fill={report.COLORS.event}
                        opacity={0.6}
                        className={showMoreStats ? styles.animateBarHeight : ""}
                        style={{
                          transformOrigin: `center ${smallChart.height - smallChart.padding}px`,
                          animationDelay: `${delay}s`,
                          transform: showMoreStats ? undefined : "scaleY(0)" // Ensure hidden initially
                        }}
                      />
                    );
                  })}

                  {/* Axis Labels */}
                  {smallChart.xTicks.map((t, idx) => (
                    <text
                      key={`ex-${idx}`}
                      x={t.x}
                      y={smallChart.height - 10}
                      textAnchor={
                        idx === 0 ? "start" : idx === smallChart.xTicks.length - 1 ? "end" : "middle"
                      }
                      className={styles.axisLabel}
                    >
                      {t.label}
                    </text>
                  ))}
                </svg>
              </div>

              <div className={styles.chartContainer}>
                <div className={styles.chartTitle}>噪音等级分布</div>
                <div className={styles.distributionChart}>
                  <div className={styles.distributionBar}>
                    <div
                      className={`${styles.distributionSegment} ${showMoreStats ? styles.animateBarWidth : ""}`}
                      style={{
                        width: `${report.distribution.quiet * 100}%`,
                        backgroundColor: report.COLORS.quiet,
                        animationDelay: "0s",
                        transform: showMoreStats ? undefined : "scaleX(0)", // Ensure hidden initially
                        transformOrigin: "left"
                      }}
                    />
                    <div
                      className={`${styles.distributionSegment} ${showMoreStats ? styles.animateBarWidth : ""}`}
                      style={{
                        width: `${report.distribution.normal * 100}%`,
                        backgroundColor: report.COLORS.normal,
                        animationDelay: "0.2s",
                        transform: showMoreStats ? undefined : "scaleX(0)",
                        transformOrigin: "left"
                      }}
                    />
                    <div
                      className={`${styles.distributionSegment} ${showMoreStats ? styles.animateBarWidth : ""}`}
                      style={{
                        width: `${report.distribution.loud * 100}%`,
                        backgroundColor: report.COLORS.loud,
                        animationDelay: "0.4s",
                        transform: showMoreStats ? undefined : "scaleX(0)",
                        transformOrigin: "left"
                      }}
                    />
                    <div
                      className={`${styles.distributionSegment} ${showMoreStats ? styles.animateBarWidth : ""}`}
                      style={{
                        width: `${report.distribution.severe * 100}%`,
                        backgroundColor: report.COLORS.severe,
                        animationDelay: "0.6s",
                        transform: showMoreStats ? undefined : "scaleX(0)",
                        transformOrigin: "left"
                      }}
                    />
                  </div>
                </div>
                <div className={styles.legend}>
                  <div className={styles.legendItem}>
                    <div
                      className={styles.legendColor}
                      style={{ background: report.COLORS.quiet }}
                    />
                    安静 ({(report.distribution.quiet * 100).toFixed(0)}%)
                  </div>
                  <div className={styles.legendItem}>
                    <div
                      className={styles.legendColor}
                      style={{ background: report.COLORS.normal }}
                    />
                    正常 ({(report.distribution.normal * 100).toFixed(0)}%)
                  </div>
                  <div className={styles.legendItem}>
                    <div
                      className={styles.legendColor}
                      style={{ background: report.COLORS.loud }}
                    />
                    吵闹 ({(report.distribution.loud * 100).toFixed(0)}%)
                  </div>
                  <div className={styles.legendItem}>
                    <div
                      className={styles.legendColor}
                      style={{ background: report.COLORS.severe }}
                    />
                    极吵 ({(report.distribution.severe * 100).toFixed(0)}%)
                  </div>
                </div>
              </div>

              <div className={styles.chartContainer}>
                <div className={styles.chartTitle}>扣分归因 (越长扣分越多)</div>
                <div className={styles.penaltyList}>
                  <div className={styles.penaltyItem}>
                    <div className={styles.penaltyLabel}>持续</div>
                    <div className={styles.penaltyBarTrack}>
                      <div
                        className={`${styles.penaltyBarFill} ${showMoreStats ? styles.animateBarWidth : ""}`}
                        style={{
                          width: `${report.sustainedPenalty * 100}%`,
                          backgroundColor: report.COLORS.sustained,
                          animationDelay: "0s",
                          transform: showMoreStats ? undefined : "scaleX(0)",
                          transformOrigin: "left"
                        }}
                      />
                    </div>
                    <div className={styles.penaltyValue}>
                      {(report.sustainedPenalty * 100).toFixed(0)}%
                    </div>
                  </div>

                  <div className={styles.penaltyItem}>
                    <div className={styles.penaltyLabel}>时长</div>
                    <div className={styles.penaltyBarTrack}>
                      <div
                        className={`${styles.penaltyBarFill} ${showMoreStats ? styles.animateBarWidth : ""}`}
                        style={{
                          width: `${report.timePenalty * 100}%`,
                          backgroundColor: report.COLORS.time,
                          animationDelay: "0.2s",
                          transform: showMoreStats ? undefined : "scaleX(0)",
                          transformOrigin: "left"
                        }}
                      />
                    </div>
                    <div className={styles.penaltyValue}>
                      {(report.timePenalty * 100).toFixed(0)}%
                    </div>
                  </div>

                  <div className={styles.penaltyItem}>
                    <div className={styles.penaltyLabel}>打断</div>
                    <div className={styles.penaltyBarTrack}>
                      <div
                        className={`${styles.penaltyBarFill} ${showMoreStats ? styles.animateBarWidth : ""}`}
                        style={{
                          width: `${report.segmentPenalty * 100}%`,
                          backgroundColor: report.COLORS.segment,
                          animationDelay: "0.4s",
                          transform: showMoreStats ? undefined : "scaleX(0)",
                          transformOrigin: "left"
                        }}
                      />
                    </div>
                    <div className={styles.penaltyValue}>
                      {(report.segmentPenalty * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.empty}>暂无更多数据</div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default NoiseReportModal;
