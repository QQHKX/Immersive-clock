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

/**
 * 计算音频数据的 RMS (均方根) 和峰值
 * @param data 浮点音频采样数据
 * @returns 包含 RMS 和峰值的对象
 */
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

/**
 * 将 RMS 转换为分贝 (dBFS)
 * @param rms 均方根值
 * @returns 分贝值，范围限制在 -100 到 0 dB
 */
function computeDbfsFromRms(rms: number): number {
  const safe = Math.max(1e-12, rms);
  const dbfs = 20 * Math.log10(safe);
  return Math.max(-100, Math.min(0, dbfs));
}

/**
 * 创建噪音帧处理器
 * @param options 配置选项
 * @returns 返回控制器对象 (start, stop, isRunning)
 */
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
