import type { NoiseSliceSummary } from "../../types/noise";
import type { NoiseRealtimePoint } from "./noiseRealtimeRingBuffer";
import { createNoiseRealtimeRingBuffer } from "./noiseRealtimeRingBuffer";
import { startNoiseCapture, stopNoiseCapture } from "./noiseCapture";
import { createNoiseFrameProcessor } from "./noiseFrameProcessor";
import { createNoiseSliceAggregator } from "./noiseSliceAggregator";
import { writeNoiseSlice } from "../../utils/noiseSliceService";
import { getAppSettings } from "../../utils/appSettings";
import { getNoiseControlSettings } from "../../utils/noiseControlSettings";
import { subscribeSettingsEvent, SETTINGS_EVENTS } from "../../utils/settingsEvents";
import { DEFAULT_NOISE_SCORE_OPTIONS } from "../../utils/noiseScoreEngine";

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

const RETENTION_MS = 5 * 60 * 1000;
const STOP_DEBOUNCE_MS = 400;

function computeDisplayDbFromRms(params: {
  rms: number;
  baselineRms: number;
  displayBaselineDb: number;
}): number {
  const safeRms = Math.max(1e-12, params.rms);
  if (params.baselineRms > 0) {
    return (
      params.displayBaselineDb +
      20 * Math.log10(safeRms / Math.max(1e-12, params.baselineRms))
    );
  }
  return Math.max(20, Math.min(100, 20 * Math.log10(safeRms / 1e-3) + 60));
}

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

let listeners = new Set<Listener>();
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

let captureCleanup: (() => Promise<void>) | null = null;
let processorStop: (() => void) | null = null;
let aggregatorFlush: (() => NoiseSliceSummary | null) | null = null;

let windowSamples: { t: number; v: number }[] = [];
let ringBuffer = createNoiseRealtimeRingBuffer({
  retentionMs: RETENTION_MS,
  capacity:
    Math.ceil(RETENTION_MS / Math.max(10, Math.round(getNoiseControlSettings().frameMs))) + 32,
});

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

let settingsUnsubscribe: (() => void) | null = null;
let baselineUnsubscribe: (() => void) | null = null;

function emit() {
  snapshot = {
    ...snapshot,
    ringBuffer: ringBuffer.snapshot(),
  };
  listeners.forEach((fn) => fn());
}

function setSnapshot(patch: Partial<NoiseStreamSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((fn) => fn());
}

async function hardStop() {
  if (!running) return;
  running = false;
  stopped = true;

  try {
    processorStop?.();
  } catch {}
  processorStop = null;

  try {
    const last = aggregatorFlush?.();
    if (last) writeNoiseSlice(last);
  } catch {}
  aggregatorFlush = null;

  try {
    await captureCleanup?.();
  } catch {}
  captureCleanup = null;
}

async function hardStart() {
  if (running) return;
  running = true;
  stopped = false;

  windowSamples = [];
  ringBuffer = createNoiseRealtimeRingBuffer({
    retentionMs: RETENTION_MS,
    capacity: Math.ceil(RETENTION_MS / Math.max(10, Math.round(frameMs))) + 32,
  });

  setSnapshot({ status: "initializing", latestSlice: snapshot.latestSlice });

  try {
    const capture = await startNoiseCapture({
      analyserFftSize: 2048,
      highpassHz: 80,
      lowpassHz: 8000,
    });
    captureCleanup = () => stopNoiseCapture(capture);

    const aggregator = createNoiseSliceAggregator({
      sliceSec,
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

        const displayDb = computeDisplayDbFromRms({ rms: frame.rms, baselineRms, displayBaselineDb });
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
          typeof next?.frameMs === "number" && Number.isFinite(next.frameMs) ? next.frameMs : fallback.frameMs;
        const nextSliceSec =
          typeof next?.sliceSec === "number" && Number.isFinite(next.sliceSec) ? next.sliceSec : fallback.sliceSec;
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

  baselineUnsubscribe = subscribeSettingsEvent(SETTINGS_EVENTS.NoiseBaselineUpdated, (evt: CustomEvent) => {
    try {
      const detail = evt.detail as { baselineRms?: unknown; baselineDb?: unknown } | undefined;
      if (typeof detail?.baselineRms === "number") baselineRms = detail.baselineRms;
      if (typeof detail?.baselineDb === "number") displayBaselineDb = detail.baselineDb;
    } catch {
      baselineRms = getAppSettings().noiseControl.baselineRms;
    }
  });
}

function clearStopTimer() {
  if (stopTimer != null) {
    window.clearTimeout(stopTimer);
    stopTimer = null;
  }
}

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

export function getNoiseStreamSnapshot(): NoiseStreamSnapshot {
  return {
    ...snapshot,
    ringBuffer: ringBuffer.snapshot(),
  };
}

export async function restartNoiseStream(): Promise<void> {
  clearStopTimer();
  await hardStop();
  if (listeners.size > 0) {
    await hardStart();
  }
}

