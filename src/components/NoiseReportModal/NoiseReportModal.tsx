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

function formatDuration(ms: number) {
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}分${s}秒`;
}

function formatMinutes(ms: number) {
  const m = Math.round(ms / 60_000);
  return `${m} 分钟`;
}

function formatTimeHHMM(d: Date) {
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function getScoreLevelText(score: number) {
  if (score >= 90) return "优秀";
  if (score >= 75) return "良好";
  if (score >= 60) return "一般";
  return "较差";
}

export const NoiseReportModal: React.FC<NoiseReportModalProps> = ({ isOpen, onClose, period }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(860);
  const [isGridSingleColumn, setIsGridSingleColumn] = useState(false);
  const [tick, setTick] = useState(0);

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

    // Colors matching dark theme (Material Design dark theme palette)
    const COLORS = {
      quiet: "#81C784", // Green 300 - muted green
      normal: "#64B5F6", // Blue 300 - muted blue
      loud: "#FFB74D", // Orange 300 - muted orange
      severe: "#E57373", // Red 300 - muted red
      sustained: "#FFD54F", // Amber 300
      time: "#FF8A65", // Deep Orange 300
      segment: "#F06292", // Pink 300
      score: "#BA68C8", // Purple 300
      event: "#E57373", // Red 300
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

      // Distribution
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
        scoreY: mapY(p.score * 0.8), // Scale score 0-100 to 0-80 range for visual consistency
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
    // Determine width for small charts in the grid
    // Chart container has 12px padding on each side (24px total)
    // Grid gap is 12px
    const containerPadding = 24;
    const gridGap = 12;

    // If single column (mobile), use full width minus padding. 
    // Otherwise use half width minus half gap minus padding.
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

    // Use fewer ticks for small chart
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
            关闭
          </FormButton>
        </div>
      }
    >
      <div className={styles.container}>
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>报告概览</h4>
          <div className={styles.overviewGrid}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>时长</div>
              <div className={styles.cardValue}>
                {period ? formatMinutes(periodDurationMs) : "—"}
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>表现</div>
              <div className={styles.cardValue}>
                {scoreInfo ? `${scoreInfo.score} 分` : "—"}
                {scoreInfo ? <span className={styles.cardSub}>（{scoreInfo.level}）</span> : null}
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>峰值</div>
              <div className={styles.cardValue}>
                {report ? `${report.maxDb.toFixed(1)} dB` : "—"}
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>平均</div>
              <div className={styles.cardValue}>
                {report ? `${report.avgDb.toFixed(1)} dB` : "—"}
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>超阈时长</div>
              <div className={styles.cardValue}>
                {report ? formatDuration(report.overDurationMs) : "—"}
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>打断次数</div>
              <div className={styles.cardValue}>{report ? String(report.segmentCount) : "—"}</div>
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
                    className={styles.line}
                    stroke="url(#lineGradient)"
                    style={{ stroke: "url(#lineGradient)" }}
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

        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>更多统计</h4>
          {report ? (
            <div className={styles.chartGrid}>
              <div className={styles.chartContainer}>
                <div className={styles.chartTitle}>评分走势 (0-100)</div>
                <svg
                  width={smallChart.width}
                  height={smallChart.height}
                  viewBox={`0 0 ${smallChart.width} ${smallChart.height}`}
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
                    return (
                      <rect
                        key={i}
                        x={p.x - barWidth / 2}
                        y={y}
                        width={Math.max(1, barWidth - 1)}
                        height={barHeight}
                        fill={report.COLORS.event}
                        opacity={0.6}
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
                      className={styles.distributionSegment}
                      style={{
                        width: `${report.distribution.quiet * 100}%`,
                        backgroundColor: report.COLORS.quiet,
                      }}
                    />
                    <div
                      className={styles.distributionSegment}
                      style={{
                        width: `${report.distribution.normal * 100}%`,
                        backgroundColor: report.COLORS.normal,
                      }}
                    />
                    <div
                      className={styles.distributionSegment}
                      style={{
                        width: `${report.distribution.loud * 100}%`,
                        backgroundColor: report.COLORS.loud,
                      }}
                    />
                    <div
                      className={styles.distributionSegment}
                      style={{
                        width: `${report.distribution.severe * 100}%`,
                        backgroundColor: report.COLORS.severe,
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
                        className={styles.penaltyBarFill}
                        style={{
                          width: `${report.sustainedPenalty * 100}%`,
                          backgroundColor: report.COLORS.sustained,
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
                        className={styles.penaltyBarFill}
                        style={{
                          width: `${report.timePenalty * 100}%`,
                          backgroundColor: report.COLORS.time,
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
                        className={styles.penaltyBarFill}
                        style={{
                          width: `${report.segmentPenalty * 100}%`,
                          backgroundColor: report.COLORS.segment,
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
