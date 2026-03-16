import React, { useMemo } from "react";

import {
  NOISE_ANALYSIS_FRAME_MS,
  NOISE_ANALYSIS_SLICE_SEC,
  NOISE_REALTIME_CHART_SLICE_COUNT,
} from "../../constants/noise";
import { useNoiseStream } from "../../hooks/useNoiseStream";

import styles from "./NoiseSettings.module.css";

export const RealTimeNoiseChart: React.FC = () => {
  const { ringBuffer, maxLevelDb, status } = useNoiseStream();

  const { points, threshold, latest, width, height, margin, yTicks, yScale, path, thresholdY } =
    useMemo(() => {
      const points = ringBuffer.filter(
        (p) => Number.isFinite(p.t) && Number.isFinite(p.displayDb) && Number.isFinite(p.dbfs)
      );
      const threshold = maxLevelDb;
      const latest = points.length ? points[points.length - 1] : null;

      const width = 640;
      const height = 160;
      const margin = { top: 12, right: 12, bottom: 22, left: 36 };

      const values = points.map((p) => p.displayDb);
      const minV = values.length ? Math.min(...values, threshold) : threshold - 10;
      const maxV = values.length ? Math.max(...values, threshold) : threshold + 10;
      const pad = Math.max(2, (maxV - minV) * 0.1);
      const yMin = Math.max(20, Math.floor(minV - pad));
      const yMax = Math.min(100, Math.ceil(maxV + pad));

      const fallbackSpanMs = Math.max(
        1,
        NOISE_ANALYSIS_SLICE_SEC * NOISE_REALTIME_CHART_SLICE_COUNT * 1000
      );
      const endTs = points.length ? points[points.length - 1].t : Date.now();
      const startTs = endTs - fallbackSpanMs;
      const span = fallbackSpanMs;

      const xScale = (t: number) => {
        const x0 = margin.left;
        const x1 = width - margin.right;
        return x0 + ((t - startTs) / span) * (x1 - x0);
      };
      const yScale = (v: number) => {
        const y0 = height - margin.bottom;
        const y1 = margin.top;
        return y0 - ((v - yMin) / (yMax - yMin)) * (y0 - y1);
      };

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

      const gapThresholdMs = Math.max(500, NOISE_ANALYSIS_FRAME_MS * 8);
      let path = "";
      for (let i = 0; i < points.length; i++) {
        const prev = i > 0 ? points[i - 1] : null;
        const p = points[i];
        const isGap = prev ? p.t - prev.t > gapThresholdMs : true;
        path += `${isGap ? "M" : "L"} ${xScale(p.t)} ${yScale(p.displayDb)} `;
      }
      path = path.trim();

      const thresholdY = yScale(threshold);

      return { points, threshold, latest, width, height, margin, yTicks, yScale, path, thresholdY };
    }, [ringBuffer, maxLevelDb]);

  return (
    <>
      <div className={styles.chartHeader}>
        <div>阈值：{threshold.toFixed(0)} dB</div>
        <div>
          当前：
          {latest && (status === "quiet" || status === "noisy")
            ? `${latest.displayDb.toFixed(1)} dB`
            : "—"}
        </div>
      </div>
      <div className={styles.chart}>
        {points.length === 0 ? (
          <div className={styles.empty}>暂无数据</div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="实时噪音折线图"
          >
            {yTicks.map((yt, i) => (
              <g key={`ytick-${i}`}>
                <line
                  x1={margin.left}
                  x2={width - margin.right}
                  y1={yScale(yt)}
                  y2={yScale(yt)}
                  className={styles.gridLine}
                />
                <text
                  x={margin.left - 8}
                  y={yScale(yt)}
                  dy="0.32em"
                  textAnchor="end"
                  className={styles.tickLabel}
                >
                  {yt.toFixed(0)}
                </text>
              </g>
            ))}

            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={thresholdY}
              y2={thresholdY}
              className={styles.threshold}
            />

            <path d={path} className={styles.line} />

            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={height - margin.bottom}
              y2={height - margin.bottom}
              className={styles.axis}
            />
            <line
              x1={margin.left}
              x2={margin.left}
              y1={margin.top}
              y2={height - margin.bottom}
              className={styles.axis}
            />
          </svg>
        )}
      </div>
      <div className={styles.sourceNote}>
        显示最近 1 个切片时长（{NOISE_ANALYSIS_SLICE_SEC}秒）的高帧率实时分贝（不落库）。
      </div>
    </>
  );
};

export default RealTimeNoiseChart;
