import React, { useCallback, useEffect, useState } from 'react';
import styles from '../SettingsPanel.module.css';
import { FormSection, FormButton, FormButtonGroup, FormSlider, FormCheckbox, FormInput, FormRow } from '../../FormComponents';
import { PlusIcon, TrashIcon, SaveIcon, VolumeIcon, VolumeMuteIcon } from '../../Icons';
import RealTimeNoiseChart from '../../NoiseSettings/RealTimeNoiseChart';
import NoiseStatsSummary from '../../NoiseSettings/NoiseStatsSummary';
import NoiseAlertHistory from '../../NoiseSettings/NoiseAlertHistory';
import { StudyPeriod, DEFAULT_SCHEDULE } from '../../StudyStatus';
import { getNoiseReportSettings, setAutoPopupSetting } from '../../../utils/noiseReportSettings';
import { readStudySchedule, writeStudySchedule } from '../../../utils/studyScheduleStorage';

/**
 * 学习功能分段组件的属性
 * - `onScheduleSave`：保存课程表后的回调
 */
export interface StudySettingsPanelProps {
  onScheduleSave?: (schedule: StudyPeriod[]) => void;
  onRegisterSave?: (fn: () => void) => void;
}

const BASELINE_NOISE_KEY = 'noise-monitor-baseline';

/**
 * 学习功能分段组件
 * - 噪音校准与报告设置
 * - 噪音图表与历史
 * - 课程表编辑
 */
/**
 * 学习功能分段组件
 * - 噪音校准与报告设置
 * - 噪音图表与历史
 * - 课程表编辑
 */
export const StudySettingsPanel: React.FC<StudySettingsPanelProps> = ({ onScheduleSave, onRegisterSave }) => {
  const [noiseBaseline, setNoiseBaseline] = useState<number>(() => {
    const saved = localStorage.getItem(BASELINE_NOISE_KEY);
    return saved ? parseFloat(saved) : 0;
  });
  const [sliderValue, setSliderValue] = useState<number>(() => {
    const saved = localStorage.getItem(BASELINE_NOISE_KEY);
    return saved ? parseFloat(saved) : 50;
  });
  const [autoPopupReport, setAutoPopupReport] = useState<boolean>(() => getNoiseReportSettings().autoPopup);

  const [schedule, setSchedule] = useState<StudyPeriod[]>(DEFAULT_SCHEDULE);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 加载课程表与噪音设置为草稿
  useEffect(() => {
    const data = readStudySchedule();
    setSchedule(Array.isArray(data) && data.length > 0 ? data : DEFAULT_SCHEDULE);
    const saved = localStorage.getItem(BASELINE_NOISE_KEY);
    const savedValue = saved ? parseFloat(saved) : 0;
    setNoiseBaseline(savedValue);
    setSliderValue(savedValue > 0 ? savedValue : 50);
    setAutoPopupReport(getNoiseReportSettings().autoPopup);
  }, []);

  const handleSliderChange = useCallback((value: number) => {
    setSliderValue(value);
    setNoiseBaseline(value);
  }, []);

  const handleClearNoiseBaseline = useCallback(() => {
    if (confirm('确定要清除噪音校准吗？这将重置为未校准状态。')) {
      setNoiseBaseline(0);
      setSliderValue(50);
      alert('噪音校准已清除（未保存）');
    }
  }, []);

  const performCalibration = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
      });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      const samples: number[] = [];
      const sampleDuration = 3000;
      const sampleInterval = 100;
      const totalSamples = sampleDuration / sampleInterval;
      for (let i = 0; i < totalSamples; i++) {
        await new Promise(resolve => setTimeout(resolve, sampleInterval));
        const dataArray = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(dataArray);
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
      microphone.disconnect();
      audioContext.close();
      stream.getTracks().forEach(track => track.stop());
      if (samples.length > 0) {
        const averageBaseline = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
        setNoiseBaseline(averageBaseline);
        setSliderValue(averageBaseline);
        alert(`噪音校准完成！基准值设置为 ${averageBaseline.toFixed(1)}dB（未保存）`);
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

  const handleRecalibrate = useCallback(async () => {
    if (confirm('确定要重新校准噪音基准吗？请确保当前环境安静，校准过程需要3秒。')) {
      await performCalibration();
    }
  }, [performCalibration]);

  // 课程表交互
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

  const handleDeletePeriod = useCallback((id: string) => {
    const newSchedule = schedule.filter(period => period.id !== id);
    setSchedule(newSchedule);
    if (editingId === id) setEditingId(null);
  }, [schedule, editingId]);

  const handleUpdatePeriod = useCallback((id: string, field: keyof StudyPeriod, value: string) => {
    const newSchedule = schedule.map(period => 
      period.id === id ? { ...period, [field]: value } : period
    );
    setSchedule(newSchedule);
  }, [schedule]);

  const isValidTime = (time: string): boolean => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  const isValidPeriod = (period: StudyPeriod): boolean => {
    if (!period.name.trim() || !isValidTime(period.startTime) || !isValidTime(period.endTime)) return false;
    const start = new Date(`2000-01-01 ${period.startTime}`);
    const end = new Date(`2000-01-01 ${period.endTime}`);
    return start < end;
  };

  const handleSaveSchedule = useCallback(() => {
    const invalidPeriods = schedule.filter(period => !isValidPeriod(period));
    if (invalidPeriods.length > 0) {
      alert('请检查课程时段设置，确保名称不为空且时间格式正确');
      return;
    }
    // 不直接持久化，统一由主面板的“保存”进行写入
    alert('课程表已更新为草稿，最终请点击面板下方“保存”应用变更');
  }, [schedule, onScheduleSave]);

  // 注册保存：在父组件点击保存时统一写入持久化存储
  useEffect(() => {
    onRegisterSave?.(() => {
      // 噪音基线
      if (noiseBaseline > 0) {
        localStorage.setItem(BASELINE_NOISE_KEY, noiseBaseline.toString());
      } else {
        localStorage.removeItem(BASELINE_NOISE_KEY);
      }
      // 自动弹出报告设置
      setAutoPopupSetting(autoPopupReport);
      // 课程表
      const invalidPeriods = schedule.filter(period => !isValidPeriod(period));
      if (invalidPeriods.length === 0) {
        writeStudySchedule(schedule);
        onScheduleSave?.(schedule);
      }
    });
  }, [onRegisterSave, noiseBaseline, autoPopupReport, schedule, onScheduleSave]);

  const handleResetSchedule = useCallback(() => {
    if (confirm('确定要重置课程表吗？这将恢复到默认设置。')) {
      setSchedule(DEFAULT_SCHEDULE);
      setEditingId(null);
    }
  }, []);

  return (
    <div className={styles.settingsGroup} id="study-panel" role="tabpanel" aria-labelledby="study">
      <h3 className={styles.groupTitle}>学习功能</h3>

      <FormSection title="噪音校准设置">
        <div className={styles.noiseCalibrationInfo}>
          <p className={styles.infoText}>
            当前校准值: {noiseBaseline > 0 ? `${noiseBaseline.toFixed(1)}dB` : '未校准'}
          </p>
          <p className={styles.helpText}>噪音校准用于适应不同环境的基准音量。校准后，噪音监测将更准确地判断当前环境是否安静。</p>
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
          <FormButton variant="secondary" onClick={handleRecalibrate} icon={<VolumeIcon size={16} />}>重新校准</FormButton>
          <FormButton variant="danger" onClick={handleClearNoiseBaseline} disabled={noiseBaseline === 0} icon={<VolumeMuteIcon size={16} />}>清除校准</FormButton>
        </FormButtonGroup>
      </FormSection>

  <FormSection title="噪音报告设置">
    <FormCheckbox
      label="自动弹出噪音报告"
      checked={autoPopupReport}
      onChange={(e) => {
        const checked = e.target.checked;
        setAutoPopupReport(checked);
      }}
    />
        <p className={styles.helpText}>开启后，在学习结束时会自动弹出噪音报告界面。关闭后，需要手动点击噪音状态文字查看报告。</p>
  </FormSection>

      <RealTimeNoiseChart />
      <NoiseStatsSummary />
      <NoiseAlertHistory />

      <FormSection title="课程表设置（草稿）">
        <FormButtonGroup align="right" className={styles.sectionActions}>
          <FormButton variant="secondary" onClick={handleResetSchedule}>重置</FormButton>
          <FormButton variant="primary" onClick={handleAddPeriod} icon={<PlusIcon size={16} />}>添加</FormButton>
        </FormButtonGroup>
        <div className={styles.scheduleList}>
          {schedule.map((period) => (
            <div key={period.id} className={styles.periodItem}>
              {editingId === period.id ? (
                <div className={styles.editForm}>
                  <FormInput type="text" value={period.name} onChange={(e) => handleUpdatePeriod(period.id, 'name', e.target.value)} placeholder="课程名称" />
                  <FormRow gap="sm">
                    <FormInput type="time" value={period.startTime} onChange={(e) => handleUpdatePeriod(period.id, 'startTime', e.target.value)} variant="time" />
                    <span className={styles.timeSeparator}>-</span>
                    <FormInput type="time" value={period.endTime} onChange={(e) => handleUpdatePeriod(period.id, 'endTime', e.target.value)} variant="time" />
                  </FormRow>
                  <FormButtonGroup align="right">
                    <FormButton variant="success" onClick={() => setEditingId(null)} icon={<SaveIcon size={14} />} size="sm" />
                    <FormButton variant="danger" onClick={() => handleDeletePeriod(period.id)} icon={<TrashIcon size={14} />} size="sm" />
                  </FormButtonGroup>
                </div>
              ) : (
                <div className={styles.periodDisplay} onClick={() => setEditingId(period.id)}>
                  <div className={styles.periodInfo}>
                    <span className={styles.periodName}>{period.name}</span>
                    <span className={styles.periodTime}>{period.startTime} - {period.endTime}</span>
                  </div>
                  <FormButton variant="danger" onClick={(e) => { e.stopPropagation(); handleDeletePeriod(period.id); }} icon={<TrashIcon size={14} />} size="sm" />
                </div>
              )}
            </div>
          ))}
        </div>
        <FormButtonGroup align="right">
          <FormButton variant="primary" onClick={handleSaveSchedule} icon={<SaveIcon size={14} />}>保存课程表</FormButton>
        </FormButtonGroup>
      </FormSection>
    </div>
  );
};

export default StudySettingsPanel;