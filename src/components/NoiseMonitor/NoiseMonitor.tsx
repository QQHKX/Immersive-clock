import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './NoiseMonitor.module.css';

// 噪音状态类型
type NoiseStatus = 'quiet' | 'noisy' | 'error' | 'permission-denied' | 'initializing';

// 噪音阈值（分贝）
const NOISE_THRESHOLD = 45; // 调整为更合理的阈值

// 分贝计算相关常量
const REFERENCE_LEVEL = 0.00002; // 20 微帕，标准参考声压级
const MIN_DECIBELS = -90; // 最小分贝值
const MAX_DECIBELS = -10; // 最大分贝值

// localStorage 键名
const BASELINE_NOISE_KEY = 'noise-monitor-baseline';

/**
 * 实时噪音状态监测组件
 * 功能：通过麦克风监测环境音量并显示状态
 */
const NoiseMonitor: React.FC = () => {
  const [noiseStatus, setNoiseStatus] = useState<NoiseStatus>('initializing');
  const [currentVolume, setCurrentVolume] = useState<number>(0);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [baselineNoise, setBaselineNoise] = useState<number>(() => {
    // 从 localStorage 读取保存的基准噪音值
    const saved = localStorage.getItem(BASELINE_NOISE_KEY);
    return saved ? parseFloat(saved) : 0;
  }); // 基准噪音水平
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false); // 校准状态
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  /**
   * 计算音量分贝值
   * 使用更准确的分贝计算公式
   */
  const calculateVolume = useCallback((dataArray: Uint8Array): number => {
    // 计算 RMS（均方根）值
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      // 将 0-255 范围转换为 -1 到 1 的浮点数
      const normalizedValue = (dataArray[i] - 128) / 128;
      sum += normalizedValue * normalizedValue;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    
    // 避免对数计算中的零值
    if (rms < 0.001) {
      return 20; // 返回一个较低的基准值而不是0
    }
    
    // 使用更准确的分贝计算公式
    // 参考标准：20 * log10(rms / reference)
    // 调整参考值以获得更合理的分贝范围
    const decibels = 20 * Math.log10(rms / 0.01); // 调整参考值
    
    // 将结果映射到合理的分贝范围（约 20-100 dB）
    // 这个范围更接近实际环境噪音水平
    let mappedDecibels = Math.max(20, Math.min(100, decibels + 80));
    
    // 如果有基准噪音水平，进行相对校准
    if (baselineNoise > 0) {
      // 使用更温和的校准方式，避免过度调整
      const calibrationOffset = baselineNoise - 35; // 35dB 作为标准安静环境
      mappedDecibels = Math.max(20, mappedDecibels - calibrationOffset);
    }
    
    return Math.round(mappedDecibels);
  }, [baselineNoise]);

  /**
   * 分析音频数据
   * 使用时域数据获取更准确的音量测量
   */
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    // 使用时域数据而不是频域数据，更准确地反映音量
    const dataArray = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(dataArray);
    
    const volume = calculateVolume(dataArray);
    setCurrentVolume(volume);
    
    // 根据音量设置状态
    if (volume > NOISE_THRESHOLD) {
      setNoiseStatus('noisy');
    } else {
      setNoiseStatus('quiet');
    }

    // 继续下一帧分析
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, [calculateVolume]);

  /**
   * 校准基准噪音水平
   * 在安静环境下运行3秒，计算平均噪音水平作为基准
   */
  const calibrateBaseline = useCallback(async () => {
    if (!analyserRef.current || isCalibrating) return;
    
    setIsCalibrating(true);
    const samples: number[] = [];
    const sampleDuration = 3000; // 3秒
    const sampleInterval = 100; // 每100ms采样一次
    const totalSamples = sampleDuration / sampleInterval;
    
    for (let i = 0; i < totalSamples; i++) {
      await new Promise(resolve => setTimeout(resolve, sampleInterval));
      
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.fftSize);
        analyserRef.current.getByteTimeDomainData(dataArray);
        
        // 计算原始分贝值（不使用基准校准）
        let sum = 0;
        for (let j = 0; j < dataArray.length; j++) {
          const normalizedValue = (dataArray[j] - 128) / 128;
          sum += normalizedValue * normalizedValue;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        if (rms >= 0.001) {
          // 使用与主计算函数相同的算法
          const decibels = 20 * Math.log10(rms / 0.01);
          const mappedDecibels = Math.max(20, Math.min(100, decibels + 80));
          samples.push(mappedDecibels);
        }
      }
    }
    
    if (samples.length > 0) {
      const averageBaseline = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
      setBaselineNoise(averageBaseline);
      // 保存到 localStorage，永不过期
      localStorage.setItem(BASELINE_NOISE_KEY, averageBaseline.toString());
      console.log(`噪音基准校准完成: ${averageBaseline.toFixed(1)}dB，已保存到本地存储`);
    }
    
    setIsCalibrating(false);
  }, [isCalibrating]);

  /**
   * 清除校准数据
   * 重置基准噪音值并清除本地存储
   */
  const clearCalibration = useCallback(() => {
    setBaselineNoise(0);
    localStorage.removeItem(BASELINE_NOISE_KEY);
    console.log('校准数据已清除');
  }, []);

  /**
   * 初始化音频监测
   */
  const initializeAudioMonitoring = useCallback(async () => {
    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      
      streamRef.current = stream;
      setHasPermission(true);

      // 创建音频上下文
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // 创建分析器节点
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048; // 增加 FFT 大小以提高频率分辨率
      analyser.smoothingTimeConstant = 0.3; // 降低平滑常数以提高响应速度
      analyser.minDecibels = MIN_DECIBELS;
      analyser.maxDecibels = MAX_DECIBELS;
      analyserRef.current = analyser;

      // 连接麦克风到分析器
      const microphone = audioContext.createMediaStreamSource(stream);
      microphoneRef.current = microphone;
      microphone.connect(analyser);

      // 开始分析
      analyzeAudio();
      
    } catch (error) {
      console.error('初始化音频监测失败:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setNoiseStatus('permission-denied');
        } else {
          setNoiseStatus('error');
        }
      } else {
        setNoiseStatus('error');
      }
    }
  }, [analyzeAudio]);

  /**
   * 清理音频资源
   */
  const cleanup = useCallback(() => {
    // 停止动画帧
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // 断开音频连接
    if (microphoneRef.current) {
      microphoneRef.current.disconnect();
      microphoneRef.current = null;
    }

    // 关闭音频上下文
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // 停止媒体流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    analyserRef.current = null;
  }, []);

  /**
   * 获取状态显示文本
   */
  const getStatusText = useCallback((): string => {
    if (isCalibrating) {
      return '校准中...';
    }
    
    switch (noiseStatus) {
      case 'quiet':
        return '安静';
      case 'noisy':
        return '吵闹';
      case 'permission-denied':
        return '需要麦克风权限';
      case 'error':
        return '监测失败';
      case 'initializing':
      default:
        return '初始化中...';
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
      case 'quiet':
        return styles.quiet;
      case 'noisy':
        return styles.noisy;
      case 'permission-denied':
      case 'error':
        return styles.error;
      case 'initializing':
      default:
        return styles.initializing;
    }
  }, [noiseStatus, isCalibrating]);

  /**
   * 处理点击事件
   * 支持重试和校准功能
   */
  const handleClick = useCallback(() => {
    if (isCalibrating) {
      return; // 校准中不响应点击
    }
    
    if (noiseStatus === 'permission-denied' || noiseStatus === 'error') {
      // 重试初始化
      setNoiseStatus('initializing');
      cleanup();
      setTimeout(() => {
        initializeAudioMonitoring();
      }, 100);
    } else if (noiseStatus === 'quiet' || noiseStatus === 'noisy') {
      // 在正常工作状态下点击校准，如果已有基准数据则清除
      if (baselineNoise > 0) {
        clearCalibration();
      } else {
        calibrateBaseline();
      }
    }
  }, [noiseStatus, isCalibrating, cleanup, initializeAudioMonitoring, calibrateBaseline, baselineNoise, clearCalibration]);

  // 组件挂载时初始化音频监测
  useEffect(() => {
    // 检查浏览器是否支持getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setNoiseStatus('error');
      return;
    }

    initializeAudioMonitoring();

    // 组件卸载时清理资源
    return cleanup;
  }, [initializeAudioMonitoring, cleanup]);

  return (
    <div className={styles.noiseMonitor}>
      <div 
        className={`${styles.statusText} ${getStatusClassName()}`}
        onClick={handleClick}
        title={
          isCalibrating ? '正在校准基准噪音水平...' :
          noiseStatus === 'permission-denied' || noiseStatus === 'error' ? '点击重试' :
          noiseStatus === 'quiet' || noiseStatus === 'noisy' ? 
            `当前音量: ${currentVolume.toFixed(1)}dB${baselineNoise > 0 ? ` (基准: ${baselineNoise.toFixed(1)}dB)` : ''} | 点击${baselineNoise > 0 ? '清除校准' : '校准'}` :
            `当前音量: ${currentVolume.toFixed(1)}dB`
        }
      >
        {getStatusText()}
      </div>
      {process.env.NODE_ENV === 'development' && (
        <div className={styles.debugInfo}>
          音量: {currentVolume.toFixed(1)}dB | 阈值: {NOISE_THRESHOLD}dB
          {baselineNoise > 0 && ` | 基准: ${baselineNoise.toFixed(1)}dB`}
        </div>
      )}
    </div>
  );
};

export default NoiseMonitor;