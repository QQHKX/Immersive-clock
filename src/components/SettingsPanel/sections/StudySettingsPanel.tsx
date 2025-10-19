import React, { useCallback, useEffect, useState } from 'react';
import styles from '../SettingsPanel.module.css';
import { FormSection, FormButton, FormButtonGroup, FormCheckbox, FormInput, FormRow, FormSlider } from '../../FormComponents';
import { PlusIcon, TrashIcon, SaveIcon, VolumeIcon, VolumeMuteIcon } from '../../Icons';
import RealTimeNoiseChart from '../../NoiseSettings/RealTimeNoiseChart';
import NoiseStatsSummary from '../../NoiseSettings/NoiseStatsSummary';
import { StudyPeriod, DEFAULT_SCHEDULE } from '../../StudyStatus';
import { getNoiseReportSettings, setAutoPopupSetting } from '../../../utils/noiseReportSettings';
import { readStudySchedule, writeStudySchedule } from '../../../utils/studyScheduleStorage';
import { getNoiseControlSettings, saveNoiseControlSettings } from '../../../utils/noiseControlSettings';
import { readStudyBackground, saveStudyBackground, resetStudyBackground } from '../../../utils/studyBackgroundStorage';

/**
 * 学习功能分段组件的属性
 * - `onScheduleSave`：保存课程表后的回调
 */
export interface StudySettingsPanelProps {
  onScheduleSave?: (schedule: StudyPeriod[]) => void;
  onRegisterSave?: (fn: () => void) => void;
}

const BASELINE_NOISE_KEY = 'noise-monitor-baseline';
const BASELINE_RMS_KEY = 'noise-monitor-baseline-rms';
const BASELINE_DB = 40;

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
  const [baselineRms, setBaselineRms] = useState<number>(() => {
    const savedRms = localStorage.getItem(BASELINE_RMS_KEY);
    return savedRms ? parseFloat(savedRms) : 0;
  });
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [calibrationProgress, setCalibrationProgress] = useState<number>(0);
  const [calibrationError, setCalibrationError] = useState<string | null>(null);
  const [autoPopupReport, setAutoPopupReport] = useState<boolean>(() => getNoiseReportSettings().autoPopup);

  // 噪音控制（自动噪音限制 & 手动基准噪音）
  const initialControl = getNoiseControlSettings();
  const [draftMaxNoiseLevel, setDraftMaxNoiseLevel] = useState<number>(initialControl.maxLevelDb);
  const [draftManualBaselineDb, setDraftManualBaselineDb] = useState<number>(initialControl.baselineDb);
  const [draftShowRealtimeDb, setDraftShowRealtimeDb] = useState<boolean>(initialControl.showRealtimeDb);

  const [schedule, setSchedule] = useState<StudyPeriod[]>(DEFAULT_SCHEDULE);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 背景设置草稿
  const [bgType, setBgType] = useState<'default' | 'color' | 'image'>('default');
  const [bgColor, setBgColor] = useState<string>('#0d1117');
  const [bgImage, setBgImage] = useState<string | null>(null);

  // 加载课程表与噪音设置为草稿
  useEffect(() => {
    const data = readStudySchedule();
    setSchedule(Array.isArray(data) && data.length > 0 ? data : DEFAULT_SCHEDULE);
    const savedDb = localStorage.getItem(BASELINE_NOISE_KEY);
    const savedRms = localStorage.getItem(BASELINE_RMS_KEY);
    const savedDbValue = savedDb ? parseFloat(savedDb) : 0;
    const savedRmsValue = savedRms ? parseFloat(savedRms) : 0;
    // 优先显示DB；若仅有RMS则显示为当前手动显示基准
    const currentControl = getNoiseControlSettings();
    setNoiseBaseline(savedDbValue > 0 ? savedDbValue : (savedRmsValue > 0 ? currentControl.baselineDb : 0));
    setBaselineRms(savedRmsValue);
    setAutoPopupReport(getNoiseReportSettings().autoPopup);
    // 同步噪音控制默认值
    setDraftMaxNoiseLevel(currentControl.maxLevelDb);
    setDraftManualBaselineDb(currentControl.baselineDb);
    setDraftShowRealtimeDb(currentControl.showRealtimeDb);

    // 背景设置
    const bg = readStudyBackground();
    setBgType(bg.type);
    if (bg.color) setBgColor(bg.color);
    setBgImage(bg.imageDataUrl ?? null);
  }, []);

  // 在已存在 RMS 校准的情况下，当前校准显示应与滑块的显示基准保持同步
  useEffect(() => {
    if (baselineRms > 0) {
      setNoiseBaseline(draftManualBaselineDb);
    }
  }, [draftManualBaselineDb, baselineRms]);

  const handleClearNoiseBaseline = useCallback(() => {
    if (confirm('确定要清除噪音校准吗？这将重置为未校准状态。')) {
      setNoiseBaseline(0);
      setBaselineRms(0);
      alert('噪音校准已清除（未保存）');
    }
  }, []);

  const performCalibration = useCallback(async () => {
    setCalibrationError(null);
    setIsCalibrating(true);
    setCalibrationProgress(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
      });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.25;
      // 简易A加权近似：80Hz高通 + 8kHz低通
      const highpass = audioContext.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 80;
      highpass.Q.value = 0.7;
      const lowpass = audioContext.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 8000;
      lowpass.Q.value = 0.7;

      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(analyser);

      const rmsSamples: number[] = [];
      const sampleDuration = 3000;
      const sampleInterval = 100;
      const totalSamples = Math.floor(sampleDuration / sampleInterval);

      for (let i = 0; i < totalSamples; i++) {
        await new Promise(resolve => setTimeout(resolve, sampleInterval));
        const dataArray = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(dataArray);
        let sumSq = 0;
        for (let j = 0; j < dataArray.length; j++) {
          const v = dataArray[j];
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / dataArray.length);
        const clampedRms = Math.max(rms, 1e-6);
        rmsSamples.push(clampedRms);
        setCalibrationProgress(Math.round(((i + 1) / totalSamples) * 100));
      }

      microphone.disconnect();
      highpass.disconnect();
      lowpass.disconnect();
      audioContext.close();
      stream.getTracks().forEach(track => track.stop());

      if (rmsSamples.length > 0) {
        const avgRms = rmsSamples.reduce((s, x) => s + x, 0) / rmsSamples.length;
        setBaselineRms(avgRms);
        // 使用当前手动显示基准作为校准后的显示基线
        setNoiseBaseline(draftManualBaselineDb);
        alert(`噪音校准完成！基准值设置为 ${draftManualBaselineDb}dB（未保存）`);
      } else {
        throw new Error('校准过程中未能获取有效的音频数据');
      }
    } catch (error) {
      console.error('校准失败:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setCalibrationError('需要麦克风权限才能进行噪音校准');
          alert('校准失败：需要麦克风权限才能进行噪音校准');
        } else {
          setCalibrationError(error.message);
          alert(`校准失败：${error.message}`);
        }
      } else {
        setCalibrationError('未知错误');
        alert('校准失败：未知错误');
      }
    } finally {
      setIsCalibrating(false);
    }
  }, [draftManualBaselineDb]);

  const handleRecalibrate = useCallback(async () => {
    if (isCalibrating) return;
    if (confirm('确定要开始/重新校准噪音基准吗？请确保当前环境安静，校准过程约3秒。')) {
      await performCalibration();
    }
  }, [performCalibration, isCalibrating]);

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
      // 噪音基线：统一持久化为 RMS 与显示DB
      if (baselineRms > 0) {
        localStorage.setItem(BASELINE_RMS_KEY, baselineRms.toString());
        // 将显示DB写入为滑块设定的值，保持与全局设置一致
        localStorage.setItem(BASELINE_NOISE_KEY, draftManualBaselineDb.toString());
      } else {
        localStorage.removeItem(BASELINE_RMS_KEY);
        localStorage.removeItem(BASELINE_NOISE_KEY);
      }
      // 自动弹出报告设置
      setAutoPopupSetting(autoPopupReport);
      // 噪音控制设置
      saveNoiseControlSettings({
        maxLevelDb: draftMaxNoiseLevel,
        baselineDb: draftManualBaselineDb,
        showRealtimeDb: draftShowRealtimeDb,
      });
      
      // 背景设置
      saveStudyBackground({
        type: bgType,
        color: bgType === 'color' ? bgColor : undefined,
        imageDataUrl: bgType === 'image' ? (bgImage ?? undefined) : undefined,
      });
      // 通知学习页面刷新背景
      window.dispatchEvent(new CustomEvent('study-background-updated'));
      
      // 课程表
      const invalidPeriods = schedule.filter(period => !isValidPeriod(period));
      if (invalidPeriods.length === 0) {
        writeStudySchedule(schedule);
        onScheduleSave?.(schedule);
      }
    });
  }, [onRegisterSave, baselineRms, autoPopupReport, schedule, onScheduleSave, draftManualBaselineDb, draftMaxNoiseLevel, draftShowRealtimeDb, bgType, bgColor, bgImage]);

  const handleResetSchedule = useCallback(() => {
    if (confirm('确定要重置课程表吗？这将恢复到默认设置。')) {
      setSchedule(DEFAULT_SCHEDULE);
      setEditingId(null);
    }
  }, []);

  return (
    <div className={styles.settingsGroup} id="study-panel" role="tabpanel" aria-labelledby="study">
      <h3 className={styles.groupTitle}>学习功能</h3>

      <FormSection title="噪音控制">
        <div className={styles.noiseCalibrationInfo}>
          <p className={styles.infoText}>自动噪音限制：最大允许 {draftMaxNoiseLevel.toFixed(0)}dB</p>
          <p className={styles.helpText}>超过该阈值时将判定为“吵闹”，用于提醒与报告统计。</p>
        </div>
      <FormSlider
        label="最大允许噪音级别"
        value={draftMaxNoiseLevel}
        min={40}
        max={80}
        step={1}
        onChange={setDraftMaxNoiseLevel}
        formatValue={(v: number) => `${v.toFixed(0)}dB`}
        showRange={true}
        rangeLabels={["40dB", "80dB"]}
      />
      <FormCheckbox
        label="显示实时分贝"
        checked={draftShowRealtimeDb}
        onChange={(e) => setDraftShowRealtimeDb(e.target.checked)}
      />
    </FormSection>

      <FormSection title="噪音基准与校准">
        <div className={styles.noiseCalibrationInfo}>
          <p className={styles.infoText}>显示基准：{draftManualBaselineDb.toFixed(0)}dB</p>
          <p className={styles.helpText}>显示基准用于相对 dB 映射；与校准得到的 RMS 结合后，形成稳定且可比较的分贝显示。</p>
        </div>
        <FormSlider
          label="基准噪音显示值"
          value={draftManualBaselineDb}
          min={30}
          max={60}
          step={1}
          onChange={setDraftManualBaselineDb}
          formatValue={(v: number) => `${v.toFixed(0)}dB`}
          showRange={true}
          rangeLabels={["30dB", "60dB"]}
        />

        <div className={styles.noiseCalibrationInfo}>
          <p className={styles.infoText}>
            <span
              className={`${styles.statusDot} ${baselineRms > 0 ? styles.statusCalibrated : styles.statusUncalibrated}`}
              aria-label={baselineRms > 0 ? '已校准' : '未校准'}
              title={baselineRms > 0 ? '已校准' : '未校准'}
            />
            当前校准：{noiseBaseline > 0 ? `${noiseBaseline.toFixed(1)}dB 基准` : '未校准'}
          </p>
          <p className={styles.helpText}>校准会采样约 3 秒的环境声音并计算 RMS；显示将以上方的“基准噪音显示值”作为基准进行映射，使不同设备下的监测更稳定、更可比较。</p>
          {isCalibrating && (
            <p className={styles.helpText} aria-live="polite">正在校准… 进度 {calibrationProgress}% ，请保持环境安静。</p>
          )}
          {calibrationError && (
            <p className={styles.errorText}>校准失败：{calibrationError}</p>
          )}
        </div>
        <FormButtonGroup align="left">
          <FormButton variant="secondary" onClick={handleRecalibrate} disabled={isCalibrating} icon={<VolumeIcon size={16} />}>{noiseBaseline > 0 ? '重新校准' : '开始校准'}</FormButton>
          <FormButton variant="danger" onClick={handleClearNoiseBaseline} disabled={noiseBaseline === 0 && baselineRms === 0} icon={<VolumeMuteIcon size={16} />}>清除校准</FormButton>
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

      <FormSection title="背景设置">
        <p className={styles.helpText}>选择背景来源，并支持颜色或本地图片。保存后将应用到晚自习页面。</p>
        <FormRow gap="sm">
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <input type="radio" name="bg-type" checked={bgType==='default'} onChange={() => setBgType('default')} />
            使用系统默认
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <input type="radio" name="bg-type" checked={bgType==='color'} onChange={() => setBgType('color')} />
            自定义颜色
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <input type="radio" name="bg-type" checked={bgType==='image'} onChange={() => setBgType('image')} />
            背景图片
          </label>
        </FormRow>

        {bgType === 'color' && (
          <>
            <FormRow gap="sm">
              <FormInput type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
              <FormInput type="text" value={bgColor} onChange={(e) => setBgColor(e.target.value)} placeholder="#000000" />
            </FormRow>
            <p className={styles.helpText}>支持调色盘或十六进制颜色代码（例如 #1a1a1a）。</p>
          </>
        )}

        {bgType === 'image' && (
          <>
            <FormRow gap="sm">
              <input type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => setBgImage(reader.result as string);
                  reader.readAsDataURL(file);
                }
              }} />
            </FormRow>
            {bgImage && (
              <div aria-label="背景预览" style={{
                backgroundImage: `url(${bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                width: '100%',
                height: '120px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)'
              }} />
            )}
            <p className={styles.helpText}>图片将以 cover 方式填充，自动适配不同设备尺寸。</p>
            <FormButtonGroup align="left">
              <FormButton variant="danger" onClick={() => setBgImage(null)}>清除图片</FormButton>
            </FormButtonGroup>
          </>
        )}

        <FormButtonGroup align="right">
          <FormButton variant="secondary" onClick={() => { setBgType('default'); setBgImage(null); }}>恢复默认背景</FormButton>
        </FormButtonGroup>
      </FormSection>

      <RealTimeNoiseChart />
      <NoiseStatsSummary />

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
