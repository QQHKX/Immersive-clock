import { NOISE_REALTIME_CHART_SLICE_COUNT } from "../../constants/noise";
import type { NoiseSliceSummary } from "../../types/noise";
import { getAppSettings } from "../../utils/appSettings";
import { getNoiseControlSettings } from "../../utils/noiseControlSettings";
import { DEFAULT_NOISE_SCORE_OPTIONS } from "../../utils/noiseScoreEngine";
import { writeNoiseSlice } from "../../utils/noiseSliceService";
import { subscribeSettingsEvent, SETTINGS_EVENTS } from "../../utils/settingsEvents";

import { startNoiseCapture, stopNoiseCapture } from "./noiseCapture";
import { createNoiseFrameProcessor } from "./noiseFrameProcessor";
import type { NoiseRealtimePoint } from "./noiseRealtimeRingBuffer";
import { createNoiseRealtimeRingBuffer } from "./noiseRealtimeRingBuffer";
import { createNoiseSliceAggregator } from "./noiseSliceAggregator";

export type NoiseStreamStatus = "initializing" | "quiet" | "noisy" | "permission-denied" | "error";

export interface NoiseStreamSnapshot {
  status: NoiseStreamStatus;
  realtimeDisplayDb: number;
  realtimeDbfs: number;
  maxLevelDb: number;
  showRealtimeDb: boolean;
  alertSoundEnabled: boolean;
  ringBuffer: NoiseRealtimePoint[];
  latestSlice: NoiseSliceSummary | null;
}

type Listener = () => void;

const STOP_DEBOUNCE_MS = 400;

/**
 * 计算实时噪音曲线的保留时长（毫秒）
 * 规则：固定为“3 个切片长度”，用于控制曲线窗口与内存占用。
 */
function computeRealtimeRetentionMs(sliceSec: number): number {
  return Math.max(1000, Math.round(sliceSec * NOISE_REALTIME_CHART_SLICE_COUNT * 1000));
}

/**
 * 从 RMS 计算显示的分贝值
 * @param params 包含当前 RMS、基准 RMS 和基准分贝的对象
 * @returns 显示的分贝值，范围限制在 20 到 100 dB
 */
function computeDisplayDbFromRms(params: {
  rms: number;
  baselineRms: number;
  displayBaselineDb: number;
}): number {
  const safeRms = Math.max(1e-12, params.rms);
  let displayDb: number;
  if (params.baselineRms > 0) {
    displayDb =
      params.displayBaselineDb + 20 * Math.log10(safeRms / Math.max(1e-12, params.baselineRms));
  } else {
    displayDb = 20 * Math.log10(safeRms / 1e-3) + 60;
  }
  return Math.max(20, Math.min(100, displayDb));
}

/**
 * 计算时间加权平均值
 * @param windowArr 包含时间戳和值的数组
 * @param now 当前时间戳
 * @returns 加权平均值
 */
function computeTimeWeightedAverage(windowArr: { t: number; v: number }[], now: number): number {
  if (!windowArr.length) return 0;
  let sum = 0;
  let total = 0;
  for (let i = 0; i < windowArr.length; i++) {
    const t0 = windowArr[i].t;
    const t1 = i < windowArr.length - 1 ? windowArr[i + 1].t : now;
    const dt = Math.max(0, t1 - t0);
    sum += windowArr[i].v * dt;
    total += dt;
  }
  return total > 0 ? sum / total : windowArr[windowArr.length - 1].v;
}

const listeners = new Set<Listener>();

/** 噪音流快照数据 */
let snapshot: NoiseStreamSnapshot = {
  status: "initializing",
  realtimeDisplayDb: 0,
  realtimeDbfs: 0,
  maxLevelDb: getNoiseControlSettings().maxLevelDb,
  showRealtimeDb: getNoiseControlSettings().showRealtimeDb,
  alertSoundEnabled: getNoiseControlSettings().alertSoundEnabled ?? false,
  ringBuffer: [],
  latestSlice: null,
};

let stopTimer: number | null = null;

let running = false;
let stopped = false;

/** 预热帧计数器：麦克风启动后丢弃前几帧不稳定数据 */
let warmupFramesRemaining = 0;
/** 预热帧数：约 500ms 的数据（按 50ms/帧 = 10 帧） */
const WARMUP_FRAME_COUNT = 10;

let captureCleanup: (() => Promise<void>) | null = null;
let processorStop: (() => void) | null = null;
let aggregatorFlush: (() => NoiseSliceSummary | null) | null = null;

let windowSamples: { t: number; v: number }[] = [];

let baselineRms = getAppSettings().noiseControl.baselineRms;
let displayBaselineDb = getNoiseControlSettings().baselineDb ?? 40;
let avgWindowSec = Math.max(0.2, getNoiseControlSettings().avgWindowSec);

let frameMs = getNoiseControlSettings().frameMs;
let sliceSec = getNoiseControlSettings().sliceSec;
let scoreThresholdDbfs =
  getNoiseControlSettings().scoreThresholdDbfs ?? DEFAULT_NOISE_SCORE_OPTIONS.scoreThresholdDbfs;
let segmentMergeGapMs =
  getNoiseControlSettings().segmentMergeGapMs ?? DEFAULT_NOISE_SCORE_OPTIONS.segmentMergeGapMs;
let maxSegmentsPerMin =
  getNoiseControlSettings().maxSegmentsPerMin ?? DEFAULT_NOISE_SCORE_OPTIONS.maxSegmentsPerMin;

const initialRetentionMs = computeRealtimeRetentionMs(sliceSec);
let ringBuffer = createNoiseRealtimeRingBuffer({
  retentionMs: initialRetentionMs,
  capacity: Math.ceil(initialRetentionMs / Math.max(10, Math.round(frameMs))) + 32,
});

let settingsUnsubscribe: (() => void) | null = null;
let baselineUnsubscribe: (() => void) | null = null;

/** 触发监听器更新 */
function emit() {
  snapshot = {
    ...snapshot,
    ringBuffer: ringBuffer.snapshot(),
  };
  listeners.forEach((fn) => fn());
}

/** 更新快照并触发更新 */
function setSnapshot(patch: Partial<NoiseStreamSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((fn) => fn());
}

/** 停止噪音流采集 */
async function hardStop() {
  if (!running) return;
  running = false;
  stopped = true;

  try {
    processorStop?.();
  } catch {
    /* 忽略错误 */
  }
  processorStop = null;

  try {
    const last = aggregatorFlush?.();
    if (last) writeNoiseSlice(last);
  } catch {
    /* 忽略错误 */
  }
  aggregatorFlush = null;

  try {
    await captureCleanup?.();
  } catch {
    /* 忽略错误 */
  }
  captureCleanup = null;
}

/** 启动噪音流采集 */
async function hardStart() {
  if (running) return;
  running = true;
  stopped = false;
  warmupFramesRemaining = WARMUP_FRAME_COUNT;

  windowSamples = [];
  const retentionMs = computeRealtimeRetentionMs(sliceSec);
  ringBuffer = createNoiseRealtimeRingBuffer({
    retentionMs,
    capacity: Math.ceil(retentionMs / Math.max(10, Math.round(frameMs))) + 32,
  });

  setSnapshot({ status: "initializing", latestSlice: snapshot.latestSlice, ringBuffer: [] });

  try {
    const capture = await startNoiseCapture({
      analyserFftSize: 2048,
      highpassHz: 80,
      lowpassHz: 8000,
    });
    captureCleanup = () => stopNoiseCapture(capture);

    const aggregator = createNoiseSliceAggregator({
      sliceSec,
      frameMs,
      score: { scoreThresholdDbfs, segmentMergeGapMs, maxSegmentsPerMin },
      baselineRms,
      displayBaselineDb,
      ringBuffer,
    });
    aggregatorFlush = aggregator.flush;

    const processor = createNoiseFrameProcessor({
      analyser: capture.analyser,
      frameMs,
      onFrame: (frame) => {
        if (stopped) return;

        if (warmupFramesRemaining > 0) {
          warmupFramesRemaining -= 1;
          return;
        }

        const displayDb = computeDisplayDbFromRms({
          rms: frame.rms,
          baselineRms,
          displayBaselineDb,
        });
        const now = frame.t;
        windowSamples.push({ t: now, v: displayDb });
        const cutoff = now - Math.max(200, Math.round(avgWindowSec * 1000));
        while (windowSamples.length && windowSamples[0].t < cutoff) windowSamples.shift();
        const avgDisplay = computeTimeWeightedAverage(windowSamples, now);

        const nextStatus: NoiseStreamStatus = avgDisplay >= snapshot.maxLevelDb ? "noisy" : "quiet";
        snapshot = {
          ...snapshot,
          status: nextStatus,
          realtimeDisplayDb: avgDisplay,
          realtimeDbfs: frame.dbfs,
        };

        const slice = aggregator.onFrame(frame);
        if (slice) {
          writeNoiseSlice(slice);
          snapshot = { ...snapshot, latestSlice: slice };
        }

        emit();
      },
    });
    processorStop = processor.stop;
    processor.start();
  } catch (e) {
    if (e && typeof e === "object") {
      const record = e as Record<string, unknown>;
      if (record.code === "permission-denied") {
        setSnapshot({ status: "permission-denied" });
        return;
      }
    }
    setSnapshot({ status: "error" });
  }
}

/** 确保设置监听器已注册 */
function ensureSettingsListeners() {
  if (settingsUnsubscribe || baselineUnsubscribe) return;

  settingsUnsubscribe = subscribeSettingsEvent(
    SETTINGS_EVENTS.NoiseControlSettingsUpdated,
    (evt: CustomEvent) => {
      try {
        const detail = evt.detail as { settings?: unknown } | undefined;
        const next =
          detail?.settings && typeof detail.settings === "object"
            ? (detail.settings as Record<string, unknown>)
            : null;
        const fallback = getNoiseControlSettings();

        const nextMaxLevelDb =
          typeof next?.maxLevelDb === "number" && Number.isFinite(next.maxLevelDb)
            ? next.maxLevelDb
            : fallback.maxLevelDb;
        const nextShowRealtimeDb =
          typeof next?.showRealtimeDb === "boolean" ? next.showRealtimeDb : fallback.showRealtimeDb;
        const nextAvgWindowSec =
          typeof next?.avgWindowSec === "number" && Number.isFinite(next.avgWindowSec)
            ? Math.max(0.2, next.avgWindowSec)
            : Math.max(0.2, fallback.avgWindowSec);
        const nextAlertSoundEnabled =
          typeof next?.alertSoundEnabled === "boolean"
            ? next.alertSoundEnabled
            : (fallback.alertSoundEnabled ?? false);
        const nextDisplayBaselineDb =
          typeof next?.baselineDb === "number" && Number.isFinite(next.baselineDb)
            ? next.baselineDb
            : (fallback.baselineDb ?? 40);

        const nextFrameMs =
          typeof next?.frameMs === "number" && Number.isFinite(next.frameMs)
            ? next.frameMs
            : fallback.frameMs;
        const nextSliceSec =
          typeof next?.sliceSec === "number" && Number.isFinite(next.sliceSec)
            ? next.sliceSec
            : fallback.sliceSec;
        const nextScoreThresholdDbfs =
          typeof next?.scoreThresholdDbfs === "number" && Number.isFinite(next.scoreThresholdDbfs)
            ? next.scoreThresholdDbfs
            : (fallback.scoreThresholdDbfs ?? DEFAULT_NOISE_SCORE_OPTIONS.scoreThresholdDbfs);
        const nextSegmentMergeGapMs =
          typeof next?.segmentMergeGapMs === "number" && Number.isFinite(next.segmentMergeGapMs)
            ? next.segmentMergeGapMs
            : (fallback.segmentMergeGapMs ?? DEFAULT_NOISE_SCORE_OPTIONS.segmentMergeGapMs);
        const nextMaxSegmentsPerMin =
          typeof next?.maxSegmentsPerMin === "number" && Number.isFinite(next.maxSegmentsPerMin)
            ? next.maxSegmentsPerMin
            : (fallback.maxSegmentsPerMin ?? DEFAULT_NOISE_SCORE_OPTIONS.maxSegmentsPerMin);

        snapshot = {
          ...snapshot,
          maxLevelDb: nextMaxLevelDb,
          showRealtimeDb: nextShowRealtimeDb,
          alertSoundEnabled: nextAlertSoundEnabled,
        };

        avgWindowSec = nextAvgWindowSec;
        displayBaselineDb = nextDisplayBaselineDb;

        const shouldRestart =
          nextFrameMs !== frameMs ||
          nextSliceSec !== sliceSec ||
          nextScoreThresholdDbfs !== scoreThresholdDbfs ||
          nextSegmentMergeGapMs !== segmentMergeGapMs ||
          nextMaxSegmentsPerMin !== maxSegmentsPerMin;

        frameMs = nextFrameMs;
        sliceSec = nextSliceSec;
        scoreThresholdDbfs = nextScoreThresholdDbfs;
        segmentMergeGapMs = nextSegmentMergeGapMs;
        maxSegmentsPerMin = nextMaxSegmentsPerMin;

        if (shouldRestart && running) {
          void restartNoiseStream();
          return;
        }

        listeners.forEach((fn) => fn());
      } catch {
        const s = getNoiseControlSettings();
        snapshot = {
          ...snapshot,
          maxLevelDb: s.maxLevelDb,
          showRealtimeDb: s.showRealtimeDb,
          alertSoundEnabled: s.alertSoundEnabled ?? false,
        };
        avgWindowSec = Math.max(0.2, s.avgWindowSec);
        displayBaselineDb = s.baselineDb ?? 40;
        frameMs = s.frameMs;
        sliceSec = s.sliceSec;
        scoreThresholdDbfs = s.scoreThresholdDbfs ?? DEFAULT_NOISE_SCORE_OPTIONS.scoreThresholdDbfs;
        segmentMergeGapMs = s.segmentMergeGapMs ?? DEFAULT_NOISE_SCORE_OPTIONS.segmentMergeGapMs;
        maxSegmentsPerMin = s.maxSegmentsPerMin ?? DEFAULT_NOISE_SCORE_OPTIONS.maxSegmentsPerMin;
        listeners.forEach((fn) => fn());
      }
    }
  );

  baselineUnsubscribe = subscribeSettingsEvent(
    SETTINGS_EVENTS.NoiseBaselineUpdated,
    (evt: CustomEvent) => {
      try {
        const detail = evt.detail as { baselineRms?: unknown; baselineDb?: unknown } | undefined;
        if (typeof detail?.baselineRms === "number") baselineRms = detail.baselineRms;
        if (typeof detail?.baselineDb === "number") displayBaselineDb = detail.baselineDb;
      } catch {
        baselineRms = getAppSettings().noiseControl.baselineRms;
      }
    }
  );
}

/** 清除停止定时器 */
function clearStopTimer() {
  if (stopTimer != null) {
    window.clearTimeout(stopTimer);
    stopTimer = null;
  }
}

/**
 * 订阅噪音数据流
 * @param listener 监听器函数
 * @returns 取消订阅的函数
 */
export function subscribeNoiseStream(listener: Listener): () => void {
  ensureSettingsListeners();
  listeners.add(listener);

  clearStopTimer();
  if (!running) {
    void hardStart();
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;

    clearStopTimer();
    stopTimer = window.setTimeout(() => {
      stopTimer = null;
      if (listeners.size === 0) {
        void hardStop();
      }
    }, STOP_DEBOUNCE_MS);
  };
}

/**
 * 获取噪音流当前快照
 * @returns 噪音流快照
 */
export function getNoiseStreamSnapshot(): NoiseStreamSnapshot {
  return { ...snapshot };
}

/**
 * 重启噪音采集流
 */
export async function restartNoiseStream(): Promise<void> {
  clearStopTimer();
  await hardStop();
  if (listeners.size > 0) {
    await hardStart();
  }
}
