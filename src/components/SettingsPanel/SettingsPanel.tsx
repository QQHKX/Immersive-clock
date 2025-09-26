import React, { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, Save, Volume2, VolumeX, RefreshCw } from 'react-feather';
import { useAppState, useAppDispatch } from '../../contexts/AppContext';
import { StudyPeriod, DEFAULT_SCHEDULE } from '../StudyStatus';
import { Modal } from '../Modal';
import { QuoteChannelManager } from '../QuoteChannelManager';
import { 
  FormSection, 
  FormInput, 
  FormButton, 
  FormButtonGroup, 
  FormRow 
} from '../FormComponents';
import styles from './SettingsPanel.module.css';

// localStorage 键名
const BASELINE_NOISE_KEY = 'noise-monitor-baseline';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 设置面板组件
 * 提供目标年份设置和课程表管理功能
 */
export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { study } = useAppState();
  const dispatch = useAppDispatch();
  
  const [targetYear, setTargetYear] = useState(study.targetYear);
  const [schedule, setSchedule] = useState<StudyPeriod[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noiseBaseline, setNoiseBaseline] = useState<number>(() => {
    const saved = localStorage.getItem(BASELINE_NOISE_KEY);
    return saved ? parseFloat(saved) : 0;
  });
  const [sliderValue, setSliderValue] = useState<number>(() => {
    const saved = localStorage.getItem(BASELINE_NOISE_KEY);
    return saved ? parseFloat(saved) : 50; // 默认50dB
  });
  
  /**
   * 加载课程表数据
   */
  const loadSchedule = useCallback(() => {
    const savedSchedule = localStorage.getItem('studySchedule');
    if (savedSchedule) {
      try {
        setSchedule(JSON.parse(savedSchedule));
      } catch {
        setSchedule(DEFAULT_SCHEDULE);
      }
    } else {
      setSchedule(DEFAULT_SCHEDULE);
    }
  }, []);
  
  /**
   * 保存课程表数据
   */
  const saveSchedule = useCallback((newSchedule: StudyPeriod[]) => {
    localStorage.setItem('studySchedule', JSON.stringify(newSchedule));
    setSchedule(newSchedule);
  }, []);
  
  /**
   * 验证时间格式
   */
  const isValidTime = (time: string): boolean => {
    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  };
  
  /**
   * 验证课程时段
   */
  const isValidPeriod = (period: StudyPeriod): boolean => {
    if (!period.name.trim() || !isValidTime(period.startTime) || !isValidTime(period.endTime)) {
      return false;
    }
    
    const start = new Date(`2000-01-01 ${period.startTime}`);
    const end = new Date(`2000-01-01 ${period.endTime}`);
    return start < end;
  };
  
  /**
   * 添加新课程时段
   */
  const handleAddPeriod = useCallback(() => {
    const newPeriod: StudyPeriod = {
      id: Date.now().toString(),
      name: '新课程',
      startTime: '19:00',
      endTime: '21:00'
    };
    const newSchedule = [...schedule, newPeriod];
    setSchedule(newSchedule);
    setEditingId(newPeriod.id);
  }, [schedule]);
  
  /**
   * 删除课程时段
   */
  const handleDeletePeriod = useCallback((id: string) => {
    const newSchedule = schedule.filter(period => period.id !== id);
    setSchedule(newSchedule);
    if (editingId === id) {
      setEditingId(null);
    }
  }, [schedule, editingId]);
  
  /**
   * 更新课程时段信息
   */
  const handleUpdatePeriod = useCallback((id: string, field: keyof StudyPeriod, value: string) => {
    const newSchedule = schedule.map(period => 
      period.id === id ? { ...period, [field]: value } : period
    );
    setSchedule(newSchedule);
  }, [schedule]);
  
  /**
   * 保存所有设置
   */
  const handleSaveAll = useCallback(() => {
    // 验证所有课程时段
    const invalidPeriods = schedule.filter(period => !isValidPeriod(period));
    if (invalidPeriods.length > 0) {
      alert('请检查课程时段设置，确保名称不为空且时间格式正确');
      return;
    }
    
    // 保存目标年份
    dispatch({ type: 'SET_TARGET_YEAR', payload: targetYear });
    
    // 保存课程表
    saveSchedule(schedule);
    
    // 关闭设置面板
    onClose();
  }, [targetYear, schedule, dispatch, saveSchedule, onClose]);
  
  /**
   * 重置课程表
   */
  const handleResetSchedule = useCallback(() => {
    if (confirm('确定要重置课程表吗？这将恢复到默认设置。')) {
      setSchedule(DEFAULT_SCHEDULE);
      setEditingId(null);
    }
  }, []);
  
  /**
   * 处理滑动条值变化
   */
  const handleSliderChange = useCallback((value: number) => {
    setSliderValue(value);
    setNoiseBaseline(value);
    localStorage.setItem(BASELINE_NOISE_KEY, value.toString());
  }, []);
  
  /**
   * 刷新天气数据
   */
  const handleRefreshWeather = useCallback(() => {
    // 触发天气组件刷新
    const weatherRefreshEvent = new CustomEvent('weatherRefresh');
    window.dispatchEvent(weatherRefreshEvent);
    alert('天气数据已刷新');
  }, []);
  
  /**
   * 清除噪音校准
   */
  const handleClearNoiseBaseline = useCallback(() => {
    if (confirm('确定要清除噪音校准吗？这将重置为未校准状态。')) {
      setNoiseBaseline(0);
      setSliderValue(50); // 重置滑动条到默认值
      localStorage.removeItem(BASELINE_NOISE_KEY);
      alert('噪音校准已清除');
    }
  }, []);
  
  /**
   * 执行噪音校准
   * 直接在设置面板中执行校准逻辑
   */
  const performCalibration = useCallback(async () => {
    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      
      // 创建音频上下文
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // 创建分析器节点
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      
      // 连接麦克风到分析器
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      
      // 校准过程
      const samples: number[] = [];
      const sampleDuration = 3000; // 3秒
      const sampleInterval = 100; // 每100ms采样一次
      const totalSamples = sampleDuration / sampleInterval;
      
      for (let i = 0; i < totalSamples; i++) {
        await new Promise(resolve => setTimeout(resolve, sampleInterval));
        
        const dataArray = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(dataArray);
        
        // 计算分贝值
        let sum = 0;
        for (let j = 0; j < dataArray.length; j++) {
          const normalizedValue = (dataArray[j] - 128) / 128;
          sum += normalizedValue * normalizedValue;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        if (rms >= 0.001) {
          const decibels = 20 * Math.log10(rms / 0.01);
          const mappedDecibels = Math.max(20, Math.min(100, decibels + 80));
          samples.push(mappedDecibels);
        }
      }
      
      // 清理资源
      microphone.disconnect();
      audioContext.close();
      stream.getTracks().forEach(track => track.stop());
      
      // 计算并保存校准值
      if (samples.length > 0) {
        const averageBaseline = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
        setNoiseBaseline(averageBaseline);
        setSliderValue(averageBaseline);
        localStorage.setItem(BASELINE_NOISE_KEY, averageBaseline.toString());
        alert(`噪音校准完成！基准值设置为 ${averageBaseline.toFixed(1)}dB`);
      } else {
        throw new Error('校准过程中未能获取有效的音频数据');
      }
      
    } catch (error) {
      console.error('校准失败:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          alert('校准失败：需要麦克风权限才能进行噪音校准');
        } else {
          alert(`校准失败：${error.message}`);
        }
      } else {
        alert('校准失败：未知错误');
      }
    }
  }, []);
  
  /**
   * 触发重新校准
   */
  const handleRecalibrate = useCallback(async () => {
    if (confirm('确定要重新校准噪音基准吗？请确保当前环境安静，校准过程需要3秒。')) {
      await performCalibration();
    }
  }, [performCalibration]);
  
  // 组件打开时加载数据
  useEffect(() => {
    if (isOpen) {
      setTargetYear(study.targetYear);
      loadSchedule();
      // 重新读取噪音校准值
      const saved = localStorage.getItem(BASELINE_NOISE_KEY);
      const savedValue = saved ? parseFloat(saved) : 0;
      setNoiseBaseline(savedValue);
      setSliderValue(savedValue > 0 ? savedValue : 50);
    }
  }, [isOpen, study.targetYear, loadSchedule]);
  
  if (!isOpen) return null;
  
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="设置" 
      maxWidth="lg"
      footer={
        <FormButtonGroup align="right">
          <FormButton variant="secondary" onClick={onClose}>
            取消
          </FormButton>
          <FormButton variant="primary" onClick={handleSaveAll}>
            保存
          </FormButton>
        </FormButtonGroup>
      }
    >
      <div className={styles.settingsContainer}>
        {/* 基础设置区域 */}
        <div className={styles.settingsGroup}>
          <h3 className={styles.groupTitle}>基础设置</h3>
          
          {/* 目标年份设置 */}
          <FormSection title="目标高考年份">
            <FormInput
              type="number"
              value={targetYear.toString()}
              onChange={(e) => setTargetYear(parseInt(e.target.value) || new Date().getFullYear())}
              variant="number"
              min={new Date().getFullYear()}
              max={new Date().getFullYear() + 10}
            />
          </FormSection>
          
          {/* 天气设置 */}
          <FormSection title="天气设置">
            <div className={styles.weatherInfo}>
              <p className={styles.infoText}>
                手动刷新天气数据以获取最新的天气信息。
              </p>
            </div>
            
            <FormButtonGroup align="left">
              <FormButton
                variant="secondary"
                onClick={handleRefreshWeather}
                icon={<RefreshCw size={16} />}
              >
                刷新天气
              </FormButton>
            </FormButtonGroup>
          </FormSection>
        </div>

        {/* 学习功能区域 */}
        <div className={styles.settingsGroup}>
          <h3 className={styles.groupTitle}>学习功能</h3>
          
          {/* 噪音校准设置 */}
          <FormSection title="噪音校准设置">
            <div className={styles.noiseCalibrationInfo}>
              <p className={styles.infoText}>
                当前校准值: {noiseBaseline > 0 ? `${noiseBaseline.toFixed(1)}dB` : '未校准'}
              </p>
              <p className={styles.helpText}>
                噪音校准用于适应不同环境的基准音量。校准后，噪音监测将更准确地判断当前环境是否安静。
              </p>
            </div>
            
            <div className={styles.sliderContainer}>
              <div className={styles.sliderHeader}>
                <span className={styles.sliderLabel}>调节校准值</span>
                <span className={styles.sliderValue}>{sliderValue.toFixed(1)}dB</span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={0.1}
                value={sliderValue}
                onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
                className={styles.noiseSlider}
              />
              <div className={styles.sliderRange}>
                <span>20dB</span>
                <span>100dB</span>
              </div>
            </div>
            
            <FormButtonGroup align="left">
              <FormButton
                variant="secondary"
                onClick={handleRecalibrate}
                icon={<Volume2 size={16} />}
              >
                重新校准
              </FormButton>
              <FormButton
                variant="danger"
                onClick={handleClearNoiseBaseline}
                disabled={noiseBaseline === 0}
                icon={<VolumeX size={16} />}
              >
                清除校准
              </FormButton>
            </FormButtonGroup>
          </FormSection>
          
          {/* 课程表设置 */}
          <FormSection title="课程表设置">
            <FormButtonGroup align="right" className={styles.sectionActions}>
              <FormButton 
                variant="secondary" 
                onClick={handleResetSchedule}
              >
                重置
              </FormButton>
              <FormButton 
                variant="primary" 
                onClick={handleAddPeriod}
                icon={<Plus size={16} />}
              >
                添加
              </FormButton>
            </FormButtonGroup>
                
            <div className={styles.scheduleList}>
              {schedule.map((period) => (
                <div key={period.id} className={styles.periodItem}>
                  {editingId === period.id ? (
                    <div className={styles.editForm}>
                      <FormInput
                        type="text"
                        value={period.name}
                        onChange={(e) => handleUpdatePeriod(period.id, 'name', e.target.value)}
                        placeholder="课程名称"
                      />
                      <FormRow gap="sm">
                        <FormInput
                          type="time"
                          value={period.startTime}
                          onChange={(e) => handleUpdatePeriod(period.id, 'startTime', e.target.value)}
                          variant="time"
                        />
                        <span className={styles.timeSeparator}>-</span>
                        <FormInput
                          type="time"
                          value={period.endTime}
                          onChange={(e) => handleUpdatePeriod(period.id, 'endTime', e.target.value)}
                          variant="time"
                        />
                      </FormRow>
                      <FormButtonGroup align="right">
                        <FormButton
                          variant="success"
                          onClick={() => setEditingId(null)}
                          icon={<Save size={14} />}
                          size="sm"
                        />
                        <FormButton
                          variant="danger"
                          onClick={() => handleDeletePeriod(period.id)}
                          icon={<Trash2 size={14} />}
                          size="sm"
                        />
                      </FormButtonGroup>
                    </div>
                  ) : (
                    <div className={styles.periodDisplay} onClick={() => setEditingId(period.id)}>
                      <div className={styles.periodInfo}>
                        <span className={styles.periodName}>{period.name}</span>
                        <span className={styles.periodTime}>
                          {period.startTime} - {period.endTime}
                        </span>
                      </div>
                      <FormButton
                        variant="danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePeriod(period.id);
                        }}
                        icon={<Trash2 size={14} />}
                        size="sm"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </FormSection>
        </div>

        {/* 内容管理区域 */}
        <div className={styles.settingsGroup}>
          <h3 className={styles.groupTitle}>内容管理</h3>
          
          {/* 金句渠道管理 */}
          <QuoteChannelManager />
        </div>
      </div>
    </Modal>
  );
}