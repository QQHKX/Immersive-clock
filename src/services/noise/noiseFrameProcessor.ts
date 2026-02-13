import type { NoiseFrameSample } from "../../types/noise";

export interface NoiseFrameProcessorOptions {
  analyser: AnalyserNode;
  frameMs: number;
  onFrame: (frame: NoiseFrameSample) => void;
}

export interface NoiseFrameProcessorController {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
}

function computeRmsAndPeak(data: Float32Array): { rms: number; peak: number } {
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    const av = Math.abs(v);
    if (av > peak) peak = av;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / Math.max(1, data.length));
  return { rms, peak };
}

function computeDbfsFromRms(rms: number): number {
  const safe = Math.max(1e-12, rms);
  return 20 * Math.log10(safe);
}

export function createNoiseFrameProcessor(
  options: NoiseFrameProcessorOptions
): NoiseFrameProcessorController {
  const { analyser, onFrame } = options;
  const frameMs = Math.max(10, Math.round(options.frameMs));
  const buffer = new Float32Array(analyser.fftSize);

  let timer: number | null = null;

  const tick = () => {
    analyser.getFloatTimeDomainData(buffer);
    const { rms, peak } = computeRmsAndPeak(buffer);
    const dbfs = computeDbfsFromRms(rms);
    onFrame({ t: Date.now(), rms, dbfs, peak });
  };

  const start = () => {
    if (timer !== null) return;
    timer = window.setInterval(tick, frameMs);
  };

  const stop = () => {
    if (timer === null) return;
    window.clearInterval(timer);
    timer = null;
  };

  return {
    start,
    stop,
    isRunning: () => timer !== null,
  };
}
