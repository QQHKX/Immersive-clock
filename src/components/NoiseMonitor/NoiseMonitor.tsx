import React, { useState, useEffect, useCallback, useRef } from "react";

import { getAppSettings, updateNoiseSettings } from "../../utils/appSettings";
import { logger } from "../../utils/logger";
import { getNoiseControlSettings } from "../../utils/noiseControlSettings";
import type { NoiseControlSettings } from "../../utils/noiseControlSettings";
import {
  readNoiseSamples,
  writeNoiseSample,
  subscribeNoiseSamplesUpdated,
} from "../../utils/noiseDataService";
import {
  subscribeSettingsEvent,
  broadcastSettingsEvent,
  SETTINGS_EVENTS,
} from "../../utils/settingsEvents";

import styles from "./NoiseMonitor.module.css";

// 噪音状态类型
type NoiseStatus = "quiet" | "noisy" | "error" | "permission-denied" | "initializing";

// 噪音阈值（分贝）从设置中读取
// 需求：默认 55dB，可在设置菜单中自定义

// 分贝计算相关常量
const MIN_DECIBELS = -90; // 最小分贝值（频域专用，保留）
const MAX_DECIBELS = -10; // 最大分贝值（频域专用，保留）
const BASELINE_DB_DEFAULT = 40; // 默认基线显示分贝

interface NoiseMonitorProps {
  // 点击状态文本时触发（安静/吵闹状态下）
  onStatusClick?: () => void;
}

/**
 * 实时噪音状态监测组件
 * 功能：通过麦克风监测环境音量并显示状态
 */
const NoiseMonitor: React.FC<NoiseMonitorProps> = ({ onStatusClick }) => {
  const [noiseStatus, setNoiseStatus] = useState<NoiseStatus>("initializing");
  const [currentVolume, setCurrentVolume] = useState<number>(0);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  // 从 AppSettings 读取
  const [baselineNoise, setBaselineNoise] = useState<number>(() => {
    return getAppSettings().noiseControl.baselineDisplayDb;
  }); // UI 显示用的基线 dB
  const [baselineRms, setBaselineRms] = useState<number>(() => {
    return getAppSettings().noiseControl.baselineRms;
  }); // 新版：用于相对 dB 计算的 RMS 基线
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false); // 校准状态
  const [thresholdDb, setThresholdDb] = useState<number>(
    () => getNoiseControlSettings().maxLevelDb
  );
  const [displayBaselineDb, setDisplayBaselineDb] = useState<number>(() => {
    const s = getNoiseControlSettings();
    return s.baselineDb ?? BASELINE_DB_DEFAULT;
  });
  const [showRealtimeDb, setShowRealtimeDb] = useState<boolean>(
    () => getNoiseControlSettings().showRealtimeDb
  );
  const [avgWindowSec, setAvgWindowSec] = useState<number>(
    () => getNoiseControlSettings().avgWindowSec
  );

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const autoCalibrationTriggeredRef = useRef<boolean>(false); // 防止重复自动校准
  const initializationCountRef = useRef<number>(0); // 初始化计数器
  const lastPersistTsRef = useRef<number>(0); // 上次持久化采样时间戳

  const highpassRef = useRef<BiquadFilterNode | null>(null);
  const lowpassRef = useRef<BiquadFilterNode | null>(null);
  const windowSamplesRef = useRef<{ t: number; v: number }[]>([]);

  // 检测是否为移动设备
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  /**
   * 移动设备特殊处理：延长稳定时间
   */
  const getMobileDelay = useCallback(() => (isMobileDevice ? 3000 : 2000), [isMobileDevice]);

  /**
   * 计算并平滑显示分贝值（相对 dB：基线定义为 40dB）
   * 使用 Float32 时域数据，提高精度；相对 dB 更稳定。
   */
  const calculateDisplayDb = useCallback(
    (dataArray: Float32Array): number => {
      // 计算 RMS（均方根）
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i];
        sum += v * v;
      }
      let rms = Math.sqrt(sum / dataArray.length);
      // 低信号保护，避免 log(0)
      rms = Math.max(rms, 1e-6);

      // 相对 dB：以校准的 baselineRms 为参考，基线显示为 40dB
      let db: number;
      if (baselineRms > 0) {
        db = displayBaselineDb + 20 * Math.log10(rms / baselineRms);
      } else {
        // 未校准时的保守映射（避免显示为 0），提示用户尽快校准
        db = Math.max(20, Math.min(100, 20 * Math.log10(rms / 1e-3) + 60));
      }

      // 返回瞬时 dB（时间窗平均实现平滑）
      const instant = Math.round(db * 10) / 10;
      return instant;
    },
    [baselineRms, displayBaselineDb]
  );

  // 状态防抖已删除：状态由每 2000ms 的持久化样本直接驱动

  /**
   * 分析音频数据
   * 使用时域数据获取更准确的音量测量
   */
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    // 使用 Float32 时域数据，更准确地反映音量
    const dataArray = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(dataArray);

    const instantDb = calculateDisplayDb(dataArray);

    const now = Date.now();
    // 维护时间窗样本
    const windowArr = windowSamplesRef.current;
    windowArr.push({ t: now, v: instantDb });
    const cutoff = now - Math.max(200, Math.round(avgWindowSec * 1000));
    while (windowArr.length && windowArr[0].t < cutoff) {
      windowArr.shift();
    }
    // 计算时间加权平均
    let sum = 0;
    let total = 0;
    for (let i = 0; i < windowArr.length; i++) {
      const t0 = windowArr[i].t;
      const t1 = i < windowArr.length - 1 ? windowArr[i + 1].t : now;
      const dt = Math.max(0, t1 - t0);
      sum += windowArr[i].v * dt;
      total += dt;
    }
    const avgDb = total > 0 ? sum / total : instantDb;

    // 每 2000ms 更新展示与状态，并持久化
    if (!lastPersistTsRef.current || now - lastPersistTsRef.current >= 2000) {
      const isNoisy = avgDb >= thresholdDb;
      writeNoiseSample({ t: now, v: avgDb, s: isNoisy ? "noisy" : "quiet" });
      // 立即用同一数据源更新UI，避免“初始化中”卡住
      setCurrentVolume(avgDb);
      setNoiseStatus(isNoisy ? "noisy" : "quiet");
      lastPersistTsRef.current = now;
    }

    // 继续下一帧分析
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, [calculateDisplayDb, thresholdDb, avgWindowSec]);

  /**
   * 校准基准噪音水平
   * 在安静环境下运行3秒，计算平均噪音水平作为基准
   */
  const calibrateBaseline = useCallback(async () => {
    if (!analyserRef.current || isCalibrating) {
      logger.debug("校准条件不满足：", {
        hasAnalyser: !!analyserRef.current,
        isCalibrating,
      });
      return;
    }

    logger.debug("开始校准基准噪音水平（RMS）...");
    setIsCalibrating(true);
    const rmsSamples: number[] = [];
    const sampleDuration = 3000; // 3秒
    const sampleInterval = 100; // 每100ms采样一次
    const totalSamples = sampleDuration / sampleInterval;

    for (let i = 0; i < totalSamples; i++) {
      await new Promise((resolve) => setTimeout(resolve, sampleInterval));
      if (analyserRef.current) {
        const dataArray = new Float32Array(analyserRef.current.fftSize);
        analyserRef.current.getFloatTimeDomainData(dataArray);
        let sum = 0;
        for (let j = 0; j < dataArray.length; j++) {
          const v = dataArray[j];
          sum += v * v;
        }
        let rms = Math.sqrt(sum / dataArray.length);
        rms = Math.max(rms, 1e-6);
        rmsSamples.push(rms);
      }
    }

    if (rmsSamples.length > 0) {
      const avgRms = rmsSamples.reduce((s, x) => s + x, 0) / rmsSamples.length;
      setBaselineRms(avgRms);

      // UI 显示基线统一为 40dB
      const manualBaseline = getNoiseControlSettings().baselineDb ?? BASELINE_DB_DEFAULT;
      setBaselineNoise(manualBaseline);

      // 更新到 AppSettings
      updateNoiseSettings({
        baselineRms: avgRms,
        baselineDisplayDb: manualBaseline,
      });

      logger.info(
        `噪音基准校准完成: baselineRms=${avgRms.toExponential(3)}，显示基线为 ${manualBaseline}dB`
      );
      // 广播：基线更新（用于其他组件提示或联动）
      broadcastSettingsEvent(SETTINGS_EVENTS.NoiseBaselineUpdated, {
        baselineDb: manualBaseline,
        baselineRms: avgRms,
      });
    }

    setIsCalibrating(false);
  }, [isCalibrating]);

  // 订阅：噪音控制设置变化，及时更新阈值、显示基线、副文本与平均时间窗
  useEffect(() => {
    const off = subscribeSettingsEvent(
      SETTINGS_EVENTS.NoiseControlSettingsUpdated,
      (evt: CustomEvent) => {
        try {
          const detail = evt.detail as { settings?: NoiseControlSettings };
          const s = (detail && detail.settings) || getNoiseControlSettings();
          if (typeof s.maxLevelDb === "number") setThresholdDb(s.maxLevelDb);
          if (typeof s.baselineDb === "number") setDisplayBaselineDb(s.baselineDb);
          if (typeof s.showRealtimeDb === "boolean") setShowRealtimeDb(!!s.showRealtimeDb);
          if (typeof s.avgWindowSec === "number") setAvgWindowSec(Math.max(0.2, s.avgWindowSec));
        } catch {
          const s = getNoiseControlSettings();
          setThresholdDb(s.maxLevelDb);
          setDisplayBaselineDb(s.baselineDb);
          setShowRealtimeDb(s.showRealtimeDb);
          setAvgWindowSec(s.avgWindowSec);
        }
      }
    );
    return off;
  }, []);

  /**
   * 清除校准数据
   * 重置基准噪音值并清除本地存储
   */

  /**
   * 初始化音频监测
   */
  const initializeAudioMonitoring = useCallback(async () => {
    // 防止重复初始化
    if (initializationCountRef.current > 0) {
      logger.debug("音频监测已在初始化中，跳过重复初始化");
      return;
    }

    initializationCountRef.current += 1;

    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      streamRef.current = stream;
      setHasPermission(true);

      // 创建音频上下文
      const audioContextCtor = window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const Ctor = audioContextCtor.AudioContext || audioContextCtor.webkitAudioContext;
      if (!Ctor) {
        logger.warn("当前环境不支持 WebAudio");
        return;
      }
      const audioContext = new Ctor();
      audioContextRef.current = audioContext;

      // 创建分析器节点
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048; // 增加 FFT 大小以提高频率分辨率
      analyser.smoothingTimeConstant = 0.3; // 降低平滑常数以提高响应速度
      analyser.minDecibels = MIN_DECIBELS;
      analyser.maxDecibels = MAX_DECIBELS;
      analyserRef.current = analyser;

      // 构建音频图：麦克风 -> 高通 -> 低通 -> 分析器
      const microphone = audioContext.createMediaStreamSource(stream);
      microphoneRef.current = microphone;

      const highpass = audioContext.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 80; // 去除低频/风噪/直流分量
      highpass.Q.value = 0.707; // Butterworth 近似
      highpassRef.current = highpass;

      const lowpass = audioContext.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 8000; // 去除超高频，近似听感范围
      lowpass.Q.value = 0.707;
      lowpassRef.current = lowpass;

      microphone.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(analyser);

      // 开始分析
      analyzeAudio();
    } catch (error) {
      logger.error("初始化音频监测失败:", error);
      if (error instanceof Error) {
        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
          setNoiseStatus("permission-denied");
        } else {
          setNoiseStatus("error");
        }
      } else {
        setNoiseStatus("error");
      }
    }
  }, [analyzeAudio]);

  // 同步阈值与手动基准dB（定时刷新，避免每帧读localStorage）
  useEffect(() => {
    const sync = () => {
      const s = getNoiseControlSettings();
      setThresholdDb(s.maxLevelDb);
      setDisplayBaselineDb(s.baselineDb ?? BASELINE_DB_DEFAULT);
      setShowRealtimeDb(s.showRealtimeDb);
      setAvgWindowSec(s.avgWindowSec);
    };
    sync();
    const id = setInterval(sync, 2000);
    return () => clearInterval(id);
  }, []);

  /**
   * 清理音频资源
   */
  const cleanup = useCallback(() => {
    // 停止动画帧
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // 已移除状态防抖相关定时器与挂起状态

    // 重置自动校准和初始化状态
    autoCalibrationTriggeredRef.current = false;
    initializationCountRef.current = 0;

    // 断开音频连接
    if (microphoneRef.current) {
      try {
        microphoneRef.current.disconnect();
      } catch {}
      microphoneRef.current = null;
    }
    if (highpassRef.current) {
      try {
        highpassRef.current.disconnect();
      } catch {}
      highpassRef.current = null;
    }
    if (lowpassRef.current) {
      try {
        lowpassRef.current.disconnect();
      } catch {}
      lowpassRef.current = null;
    }

    // 关闭音频上下文
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // 停止媒体流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    analyserRef.current = null;
  }, []);

  /**
   * 获取状态显示文本
   */
  const getStatusText = useCallback((): string => {
    if (isCalibrating) {
      return "校准中...";
    }

    switch (noiseStatus) {
      case "quiet":
        return "安静";
      case "noisy":
        return "吵闹";
      case "permission-denied":
        return "需要麦克风权限";
      case "error":
        return "监测失败";
      case "initializing":
      default:
        return "初始化中...";
    }
  }, [noiseStatus, isCalibrating]);

  /**
   * 获取状态样式类名
   */
  const getStatusClassName = useCallback((): string => {
    if (isCalibrating) {
      return styles.calibrating;
    }

    switch (noiseStatus) {
      case "quiet":
        return styles.quiet;
      case "noisy":
        return styles.noisy;
      case "permission-denied":
      case "error":
        return styles.error;
      case "initializing":
      default:
        return styles.initializing;
    }
  }, [noiseStatus, isCalibrating]);

  /**
   * 处理点击事件
   * 仅支持重试功能，不再支持校准
   */
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // 阻止事件冒泡，防止触发页面点击事件

      if (isCalibrating) {
        return; // 校准中不响应点击
      }

      if (noiseStatus === "permission-denied" || noiseStatus === "error") {
        // 重试初始化
        setNoiseStatus("initializing");
        cleanup();
        setTimeout(() => {
          initializeAudioMonitoring();
        }, 100);
      } else if (noiseStatus === "quiet" || noiseStatus === "noisy") {
        // 打开历史记录弹窗（通过父组件传入回调）
        onStatusClick?.();
      }
      // 其他状态不做处理；已移除点击校准功能
    },
    [noiseStatus, isCalibrating, cleanup, initializeAudioMonitoring, onStatusClick]
  );

  // 组件挂载时初始化音频监测
  useEffect(() => {
    // 检查浏览器是否支持getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setNoiseStatus("error");
      return;
    }

    initializeAudioMonitoring();

    // 组件卸载时清理资源
    return cleanup;
  }, [initializeAudioMonitoring, cleanup]);

  // 订阅统一噪音样本更新事件：用最后一次保存的样本驱动显示
  useEffect(() => {
    const applyLastSample = () => {
      try {
        const samples = readNoiseSamples();
        const last = samples[samples.length - 1];
        if (last) {
          setCurrentVolume(last.v);
          setNoiseStatus(last.s);
        }
      } catch {
        // 忽略异常，保持当前显示状态
      }
    };
    const unsubscribe = subscribeNoiseSamplesUpdated(applyLastSample);
    // 初次挂载时尝试应用一次（避免一直停留在“初始化中”）
    applyLastSample();
    return unsubscribe;
  }, []);

  // 自动校准：当音频监测初始化完成且没有保存的校准数据时自动开始校准
  useEffect(() => {
    // 更严格的条件检查，防止重复触发
    if (
      (noiseStatus === "quiet" || noiseStatus === "noisy") &&
      baselineRms === 0 &&
      !isCalibrating &&
      !autoCalibrationTriggeredRef.current &&
      hasPermission &&
      analyserRef.current &&
      initializationCountRef.current <= 1 // 限制初始化次数
    ) {
      logger.debug("检测到首次使用，自动开始校准...", { isMobileDevice });
      autoCalibrationTriggeredRef.current = true; // 标记已触发自动校准

      // 根据设备类型调整延迟时间
      const delay = getMobileDelay();
      setTimeout(() => {
        if (!isCalibrating && baselineRms === 0) {
          logger.debug("延迟校准开始，设备类型：", isMobileDevice ? "移动设备" : "桌面设备");
          calibrateBaseline();
        }
      }, delay);
    }
  }, [
    noiseStatus,
    baselineRms,
    isCalibrating,
    hasPermission,
    calibrateBaseline,
    getMobileDelay,
    isMobileDevice,
  ]);

  return (
    <div className={styles.noiseMonitor}>
      <div className={styles.statusContainer}>
        <div
          className={`${styles.breathingLight} ${getStatusClassName()}`}
          onClick={handleClick}
          title={
            isCalibrating
              ? "正在校准基准噪音水平..."
              : noiseStatus === "permission-denied" || noiseStatus === "error"
                ? "点击重试"
                : noiseStatus === "quiet" || noiseStatus === "noisy"
                  ? `当前音量: ${currentVolume.toFixed(0)}dB${baselineNoise > 0 ? ` (基准: ${baselineNoise.toFixed(0)}dB)` : ""}`
                  : `当前音量: ${currentVolume.toFixed(0)}dB`
          }
        ></div>
        <div className={styles.textBlock}>
          <div
            className={`${styles.statusText} ${getStatusClassName()}`}
            onClick={handleClick}
            title={
              isCalibrating
                ? "正在校准基准噪音水平..."
                : noiseStatus === "permission-denied" || noiseStatus === "error"
                  ? "点击重试"
                  : noiseStatus === "quiet" || noiseStatus === "noisy"
                    ? `当前音量: ${currentVolume.toFixed(0)}dB${baselineNoise > 0 ? ` (基准: ${baselineNoise.toFixed(0)}dB)` : ""}`
                    : `当前音量: ${currentVolume.toFixed(0)}dB`
            }
          >
            {getStatusText()}
          </div>
          {showRealtimeDb && (noiseStatus === "quiet" || noiseStatus === "noisy") && (
            <div className={styles.statusSubtext} aria-live="polite">
              {currentVolume.toFixed(0)} dB
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoiseMonitor;
