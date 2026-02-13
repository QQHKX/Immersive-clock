export type NoiseCaptureStatus =
  | "idle"
  | "initializing"
  | "running"
  | "permission-denied"
  | "error";

export interface NoiseCaptureOptions {
  highpassHz?: number;
  lowpassHz?: number;
  analyserFftSize?: number;
}

export interface NoiseCaptureSession {
  status: NoiseCaptureStatus;
  audioContext: AudioContext;
  analyser: AnalyserNode;
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  highpass: BiquadFilterNode;
  lowpass: BiquadFilterNode;
}

const DEFAULT_OPTIONS: Required<NoiseCaptureOptions> = {
  highpassHz: 80,
  lowpassHz: 8000,
  analyserFftSize: 2048,
};

/**
 * 启动环境噪音采集
 * @param options 采集配置选项
 * @returns 返回包含音频上下文和分析器的会话对象
 */
export async function startNoiseCapture(
  options?: NoiseCaptureOptions
): Promise<NoiseCaptureSession> {
  const opt = { ...DEFAULT_OPTIONS, ...(options ?? {}) };
  const AudioContextImpl =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextImpl) {
    throw new Error("AudioContext not supported");
  }
  const audioContext = new AudioContextImpl();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });

    const source = audioContext.createMediaStreamSource(stream);
    const highpass = audioContext.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = opt.highpassHz;

    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = opt.lowpassHz;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = opt.analyserFftSize;
    analyser.smoothingTimeConstant = 0;

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(analyser);

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    return {
      status: "running",
      audioContext,
      analyser,
      stream,
      source,
      highpass,
      lowpass,
    };
  } catch (e) {
    await stopNoiseCapture({ audioContext });
    const name = ((): string | undefined => {
      if (!e || typeof e !== "object") return undefined;
      const record = e as Record<string, unknown>;
      return typeof record.name === "string" ? record.name : undefined;
    })();
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw Object.assign(new Error("Microphone permission denied"), { code: "permission-denied" });
    }
    throw e;
  }
}

/**
 * 停止噪音采集并释放资源
 * @param session 需要停止的采集会话或包含资源的局部对象
 */
export async function stopNoiseCapture(
  session:
    | NoiseCaptureSession
    | {
        audioContext?: AudioContext | null;
        stream?: MediaStream | null;
      }
    | null
    | undefined
): Promise<void> {
  try {
    session?.stream?.getTracks().forEach((t) => t.stop());
  } catch {
    /* 忽略错误 */
  }

  try {
    const ctx = session?.audioContext;
    if (ctx && ctx.state !== "closed") {
      await ctx.close();
    }
  } catch {
    /* 忽略错误 */
  }
}
