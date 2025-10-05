import React, { useState, useCallback, useEffect } from 'react';
import { PlusIcon, TrashIcon, SaveIcon, VolumeIcon, VolumeMuteIcon, RefreshIcon } from '../Icons';
import { useAppState, useAppDispatch } from '../../contexts/AppContext';
import { StudyPeriod, DEFAULT_SCHEDULE } from '../StudyStatus';
import { Modal } from '../Modal';
import { QuoteChannelManager } from '../QuoteChannelManager';
import { 
  FormSection, 
  FormInput, 
  FormButton, 
  FormButtonGroup, 
  FormRow,
  FormSlider,
  FormSegmented 
} from '../FormComponents';
import { Tabs } from '../Tabs/Tabs';
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
  const { study, quoteSettings } = useAppState();
  const dispatch = useAppDispatch();
  
  const [activeCategory, setActiveCategory] = useState<'basic' | 'study' | 'content'>('basic');
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
  const [quoteRefreshInterval, setQuoteRefreshInterval] = useState<number>(quoteSettings.autoRefreshInterval);
  // 天气增强：地址、刷新状态、最后成功时间
  const [weatherAddress, setWeatherAddress] = useState<string>(() => localStorage.getItem('weather.address') || '');
  const [weatherRefreshStatus, setWeatherRefreshStatus] = useState<string>(() => localStorage.getItem('weather.refreshStatus') || '');
  const [weatherLastTs, setWeatherLastTs] = useState<number>(() => parseInt(localStorage.getItem('weather.lastSuccessTs') || '0', 10));
  
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
   * 处理金句刷新间隔变化
   */
  const handleQuoteRefreshIntervalChange = useCallback((value: number) => {
    setQuoteRefreshInterval(value);
    dispatch({ type: 'SET_QUOTE_AUTO_REFRESH_INTERVAL', payload: value });
  }, [dispatch]);

  /**
   * 格式化刷新间隔显示文本
   */
  const formatRefreshIntervalText = useCallback((seconds: number): string => {
    if (seconds === 0) {
      return '手动刷新';
    } else if (seconds < 60) {
      return `${seconds}秒`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      if (remainingSeconds === 0) {
        return `${minutes}分钟`;
      } else {
        return `${minutes}分${remainingSeconds}秒`;
      }
    }
  }, []);

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
    
    // 保存目标年份（仅在高考模式下生效，但统一持久化）
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
    setWeatherRefreshStatus('刷新中');
    localStorage.setItem('weather.refreshStatus', '刷新中');
  }, []);

  // 监听天气刷新完成事件，更新展示
  useEffect(() => {
    const onDone = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const status = detail.status || localStorage.getItem('weather.refreshStatus') || '';
      const address = detail.address || localStorage.getItem('weather.address') || '';
      const ts = detail.ts || parseInt(localStorage.getItem('weather.lastSuccessTs') || '0', 10);
      setWeatherRefreshStatus(status);
      setWeatherAddress(address);
      if (status === '成功') setWeatherLastTs(ts);
    };
    window.addEventListener('weatherRefreshDone', onDone as EventListener);
    return () => window.removeEventListener('weatherRefreshDone', onDone as EventListener);
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
      setQuoteRefreshInterval(quoteSettings.autoRefreshInterval);
      loadSchedule();
      // 重新读取噪音校准值
      const saved = localStorage.getItem(BASELINE_NOISE_KEY);
      const savedValue = saved ? parseFloat(saved) : 0;
      setNoiseBaseline(savedValue);
      setSliderValue(savedValue > 0 ? savedValue : 50);
      // 打开时默认显示基础设置
      setActiveCategory('basic');
    }
  }, [isOpen, study.targetYear, quoteSettings.autoRefreshInterval, loadSchedule]);
  
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
        {/* 顶部分类选项卡 */}
        <Tabs
          items={[
            { key: 'basic', label: '基础设置' },
            { key: 'study', label: '学习功能' },
            { key: 'content', label: '内容管理' }
          ]}
          activeKey={activeCategory}
          onChange={(key) => setActiveCategory(key as 'basic' | 'study' | 'content')}
          variant="browser"
          size="md"
          scrollable
        />

        {/* 基础设置区域 */}
        {activeCategory === 'basic' && (
        <div className={styles.settingsGroup} id="basic-panel" role="tabpanel" aria-labelledby="basic">
          <h3 className={styles.groupTitle}>基础设置</h3>
          
          {/* 倒计时设置 */}
          <FormSection title="倒计时设置">
            <p className={styles.helpText}>
              选择倒计时类型。高考模式默认使用最近一年高考日期；自定义模式可设置事件名称与日期。
            </p>
            <FormSegmented
              label="倒计时类型"
              value={(study.countdownType ?? 'gaokao')}
              options={[
                { label: '高考倒计时', value: 'gaokao' },
                { label: '自定义事件', value: 'custom' },
              ]}
              onChange={(value) => {
                dispatch({ type: 'SET_COUNTDOWN_TYPE', payload: value as 'gaokao' | 'custom' });
              }}
            />

            {(study.countdownType ?? 'gaokao') === 'gaokao' ? (
              <FormInput
                label="目标高考年份"
                type="number"
                value={targetYear.toString()}
                onChange={(e) => setTargetYear(parseInt(e.target.value) || new Date().getFullYear())}
                variant="number"
                min={new Date().getFullYear()}
                max={new Date().getFullYear() + 10}
              />
            ) : (
              <>
                <FormInput
                  label="事件名称"
                  type="text"
                  value={study.customName ?? ''}
                  onChange={(e) => {
                    dispatch({ type: 'SET_CUSTOM_COUNTDOWN', payload: { name: e.target.value, date: study.customDate ?? '' } });
                  }}
                  placeholder="例如：期末考试"
                />
                <FormInput
                  label="事件日期"
                  type="date"
                  value={study.customDate ?? ''}
                  onChange={(e) => {
                    dispatch({ type: 'SET_CUSTOM_COUNTDOWN', payload: { name: study.customName ?? '', date: e.target.value } });
                  }}
                />
              </>
            )}
          </FormSection>
          
          {/* 天气设置 */}
          <FormSection title="天气设置">
            <div className={styles.weatherInfo}>
              <p className={styles.infoText}>手动刷新天气数据以获取最新的天气信息。</p>
              <p className={styles.infoText}>定位坐标：{(() => {
                const lat = localStorage.getItem('weather.coords.lat');
                const lon = localStorage.getItem('weather.coords.lon');
                return lat && lon ? `${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}` : '未获取';
              })()}</p>
              <p className={styles.infoText}>定位方式：{(() => {
                const source = localStorage.getItem('weather.coords.source');
                if (!source) return '未获取';
                if (source === 'geolocation') return '浏览器定位';
                if (source === 'amap_ip') return '高德IP定位';
                if (source === 'ip') return '公共IP定位';
                return source;
              })()}</p>
              <p className={styles.infoText}>街道地址：{weatherAddress || '未获取'}</p>
              <p className={styles.infoText}>时间：{localStorage.getItem('weather.now.obsTime') || '未获取'}</p>
              <p className={styles.infoText}>天气：{localStorage.getItem('weather.now.text') || '未获取'}</p>
              <p className={styles.infoText}>气温：{localStorage.getItem('weather.now.temp') ? `${localStorage.getItem('weather.now.temp')}°C` : '未获取'}  体感：{localStorage.getItem('weather.now.feelsLike') ? `${localStorage.getItem('weather.now.feelsLike')}°C` : '未获取'}</p>
              <p className={styles.infoText}>风向：{localStorage.getItem('weather.now.windDir') || '未获取'}  风力：{localStorage.getItem('weather.now.windScale') || '未获取'}  风速：{localStorage.getItem('weather.now.windSpeed') ? `${localStorage.getItem('weather.now.windSpeed')} km/h` : '未获取'}</p>
              <p className={styles.infoText}>湿度：{localStorage.getItem('weather.now.humidity') ? `${localStorage.getItem('weather.now.humidity')}%` : '未获取'}  气压：{localStorage.getItem('weather.now.pressure') ? `${localStorage.getItem('weather.now.pressure')} hPa` : '未获取'}</p>
              <p className={styles.infoText}>降水：{localStorage.getItem('weather.now.precip') ? `${localStorage.getItem('weather.now.precip')} mm` : '未获取'}  能见度：{localStorage.getItem('weather.now.vis') ? `${localStorage.getItem('weather.now.vis')} km` : '未获取'}  云量：{localStorage.getItem('weather.now.cloud') || '未获取'}</p>
              <p className={styles.infoText}>露点：{localStorage.getItem('weather.now.dew') || '未获取'}</p>
              <p className={styles.infoText}>数据源：{(() => {
                const sources = localStorage.getItem('weather.refer.sources');
                return sources ? 'QWeather' : '未获取';
              })()}</p>
              <p className={styles.infoText}>许可：{(() => {
                const license = localStorage.getItem('weather.refer.license');
                return license ? 'QWeather Developers License' : '未获取';
              })()}</p>
              <p className={styles.infoText}>刷新状态：{weatherRefreshStatus || '未刷新'}</p>
              <p className={styles.infoText}>最后成功时间：{weatherLastTs > 0 ? new Date(weatherLastTs).toLocaleString() : '未成功'}</p>
            </div>
            
            <FormButtonGroup align="left">
              <FormButton
                variant="secondary"
                onClick={handleRefreshWeather}
                icon={<RefreshIcon size={16} />}
              >
                刷新天气
              </FormButton>
            </FormButtonGroup>
          </FormSection>
        </div>
        )}

        {/* 学习功能区域 */}
        {activeCategory === 'study' && (
        <div className={styles.settingsGroup} id="study-panel" role="tabpanel" aria-labelledby="study">
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
            
            <FormSlider
              label="调节校准值"
              value={sliderValue}
              min={20}
              max={100}
              step={0.1}
              onChange={handleSliderChange}
              formatValue={(value) => `${value.toFixed(1)}dB`}
              showRange={true}
              rangeLabels={['20dB', '100dB']}
            />
            
            <FormButtonGroup align="left">
              <FormButton
                variant="secondary"
                onClick={handleRecalibrate}
                icon={<VolumeIcon size={16} />}
              >
                重新校准
              </FormButton>
              <FormButton
                variant="danger"
                onClick={handleClearNoiseBaseline}
                disabled={noiseBaseline === 0}
                icon={<VolumeMuteIcon size={16} />}
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
                icon={<PlusIcon size={16} />}
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
                          icon={<SaveIcon size={14} />}
                          size="sm"
                        />
                        <FormButton
                          variant="danger"
                          onClick={() => handleDeletePeriod(period.id)}
                          icon={<TrashIcon size={14} />}
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
                        icon={<TrashIcon size={14} />}
                        size="sm"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </FormSection>
        </div>
        )}

        {/* 内容管理区域 */}
        {activeCategory === 'content' && (
        <div className={styles.settingsGroup} id="content-panel" role="tabpanel" aria-labelledby="content">
          <h3 className={styles.groupTitle}>内容管理</h3>
          
          {/* 金句自动刷新设置 */}
          <FormSection title="金句自动刷新">
            <div className={styles.quoteRefreshInfo}>
              <p className={styles.infoText}>
                当前设置: {formatRefreshIntervalText(quoteRefreshInterval)}
              </p>
              <p className={styles.helpText}>
                调节金句的自动刷新频率，左端为最短间隔30秒，右端为关闭自动刷新。
              </p>
            </div>
            
            <FormSlider
              label="刷新频率"
              value={quoteRefreshInterval}
              min={30}
              max={1800}
              step={30}
              onChange={handleQuoteRefreshIntervalChange}
              formatValue={formatRefreshIntervalText}
              showRange={true}
              rangeLabels={['30秒', '手动刷新']}
            />
          </FormSection>
          
          {/* 金句渠道管理 */}
          <QuoteChannelManager />
        </div>
        )}
      </div>
    </Modal>
  );
}