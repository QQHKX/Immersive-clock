import React, { useCallback, useEffect, useState } from 'react';
import { useAppState, useAppDispatch } from '../../../contexts/AppContext';
import { FormSection, FormInput, FormSegmented, FormButton, FormButtonGroup, FormCheckbox, FormRow } from '../../FormComponents';
import styles from '../SettingsPanel.module.css';
import ScheduleSettings from '../../ScheduleSettings';
import { readStudyBackground, saveStudyBackground } from '../../../utils/studyBackgroundStorage';

/**
 * 基础设置分段组件的属性
 * - `targetYear`：目标高考年份
 * - `onTargetYearChange`：更新目标年份的回调
 */
export interface BasicSettingsPanelProps {
  targetYear: number;
  onTargetYearChange: (year: number) => void;
  onRegisterSave?: (fn: () => void) => void;
}

/**
 * 基础设置分段组件
 * - 倒计时类型与目标年份/自定义事件设置
 * - 晚自习组件显示开关（时间始终显示）
 * - 背景设置
 * - 课表设置入口
 */
export const BasicSettingsPanel: React.FC<BasicSettingsPanelProps> = ({ targetYear, onTargetYearChange, onRegisterSave }) => {
  const { study } = useAppState();
  const dispatch = useAppDispatch();

  // 倒计时设置草稿
  const [draftCountdownType, setDraftCountdownType] = useState<'gaokao' | 'custom'>(study.countdownType ?? 'gaokao');
  const [draftCustomName, setDraftCustomName] = useState<string>(study.customName ?? '');
  const [draftCustomDate, setDraftCustomDate] = useState<string>(study.customDate ?? '');

  // 晚自习组件显示草稿（时间始终显示，不提供开关）
  const defaultDisplay = { showStatusBar: true, showNoiseMonitor: true, showCountdown: true, showQuote: true, showTime: true, showDate: true };
  const [draftDisplay, setDraftDisplay] = useState<typeof defaultDisplay>({ ...(study.display || defaultDisplay) });

  // 背景设置草稿
  const [bgType, setBgType] = useState<'default' | 'color' | 'image'>('default');
  const [bgColor, setBgColor] = useState<string>('#0d1117');
  const [bgImage, setBgImage] = useState<string | null>(null);

  // 课表设置弹窗
  const [scheduleOpen, setScheduleOpen] = useState<boolean>(false);

  useEffect(() => {
    // 同步草稿为当前应用状态（打开面板或刷新时）
    setDraftCountdownType(study.countdownType ?? 'gaokao');
    setDraftCustomName(study.customName ?? '');
    setDraftCustomDate(study.customDate ?? '');
    setDraftDisplay({ ...(study.display || defaultDisplay), showTime: true });
    // 背景设置
    const bg = readStudyBackground();
    setBgType(bg.type);
    if (bg.color) setBgColor(bg.color);
    setBgImage(bg.imageDataUrl ?? null);
  }, [study.countdownType, study.customName, study.customDate, study.display]);

  // 注册保存动作：统一在父组件保存时派发
  useEffect(() => {
    onRegisterSave?.(() => {
      dispatch({ type: 'SET_COUNTDOWN_TYPE', payload: draftCountdownType });
      if (draftCountdownType === 'custom') {
        dispatch({ type: 'SET_CUSTOM_COUNTDOWN', payload: { name: draftCustomName, date: draftCustomDate } });
      }
      // 保存组件显示设置（强制时间显示）
      dispatch({ type: 'SET_STUDY_DISPLAY', payload: { ...draftDisplay, showTime: true } });
      // 保存背景设置
      saveStudyBackground({
        type: bgType,
        color: bgType === 'color' ? bgColor : undefined,
        imageDataUrl: bgType === 'image' ? (bgImage ?? undefined) : undefined,
      });
      // 通知学习页面刷新背景
      window.dispatchEvent(new CustomEvent('study-background-updated'));
    });
  }, [onRegisterSave, draftCountdownType, draftCustomName, draftCustomDate, draftDisplay, bgType, bgColor, bgImage, dispatch]);

  return (
    <div className={styles.settingsGroup} id="basic-panel" role="tabpanel" aria-labelledby="basic">
      <h3 className={styles.groupTitle}>基础设置</h3>

      {/* 组件开关 */}
      <FormSection title="晚自习页面组件显示">
        <p className={styles.helpText}>自定义晚自习页面各组件的显示与隐藏（当前时间始终显示）。</p>
        <FormRow gap="lg" align="start">
          <FormCheckbox
            label="显示状态栏"
            checked={!!draftDisplay.showStatusBar}
            onChange={(e) => setDraftDisplay({ ...draftDisplay, showStatusBar: e.target.checked })}
          />
          <FormCheckbox
            label="显示噪音监测"
            checked={!!draftDisplay.showNoiseMonitor}
            onChange={(e) => setDraftDisplay({ ...draftDisplay, showNoiseMonitor: e.target.checked })}
          />
          <FormCheckbox
            label="显示倒计时"
            checked={!!draftDisplay.showCountdown}
            onChange={(e) => setDraftDisplay({ ...draftDisplay, showCountdown: e.target.checked })}
          />
        </FormRow>
        <FormRow gap="lg" align="start">
          <FormCheckbox
            label="显示励志金句"
            checked={!!draftDisplay.showQuote}
            onChange={(e) => setDraftDisplay({ ...draftDisplay, showQuote: e.target.checked })}
          />
          <FormCheckbox
            label="显示当前日期"
            checked={!!draftDisplay.showDate}
            onChange={(e) => setDraftDisplay({ ...draftDisplay, showDate: e.target.checked })}
          />
        </FormRow>
      </FormSection>

      {/* 高考年份/自定义事件 */}
      <FormSection title="倒计时设置">
        <p className={styles.helpText}>
          选择倒计时类型。高考模式默认使用最近一年高考日期；自定义模式可设置事件名称与日期。
        </p>
        <FormSegmented
          label="倒计时类型"
          value={draftCountdownType}
          options={[
            { label: '高考倒计时', value: 'gaokao' },
            { label: '自定义事件', value: 'custom' },
          ]}
          onChange={(value) => {
            setDraftCountdownType(value as 'gaokao' | 'custom');
          }}
        />

        {draftCountdownType === 'gaokao' ? (
          <FormInput
            label="目标高考年份"
            type="number"
            value={targetYear.toString()}
            onChange={(e) => onTargetYearChange(parseInt(e.target.value) || new Date().getFullYear())}
            variant="number"
            min={new Date().getFullYear()}
            max={new Date().getFullYear() + 10}
          />
        ) : (
          <>
            <FormInput
              label="事件名称"
              type="text"
              value={draftCustomName}
              onChange={(e) => setDraftCustomName(e.target.value)}
              placeholder="例如：期末考试"
            />
            <FormInput
              label="事件日期"
              type="date"
              value={draftCustomDate}
              onChange={(e) => setDraftCustomDate(e.target.value)}
            />
          </>
        )}
      </FormSection>

      {/* 背景设置 */}
      <FormSection title="背景设置">
        <p className={styles.helpText}>选择背景来源，并支持颜色或本地图片。保存后将应用到晚自习页面。</p>
        <FormSegmented
          label="背景来源"
          value={bgType}
          options={[
            { label: '使用系统默认', value: 'default' },
            { label: '自定义颜色', value: 'color' },
            { label: '背景图片', value: 'image' },
          ]}
          onChange={(v) => setBgType(v as 'default' | 'color' | 'image')}
        />

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

      {/* 课表设置入口 */}
      <FormSection title="课表设置">
        <p className={styles.helpText}>点击下方按钮打开课表编辑弹窗，支持添加、修改、删除与排序。</p>
        <FormButtonGroup align="left">
          <FormButton variant="primary" onClick={() => setScheduleOpen(true)}>打开课表设置</FormButton>
        </FormButtonGroup>
        <ScheduleSettings isOpen={scheduleOpen} onClose={() => setScheduleOpen(false)} onSave={() => { /* 已在弹窗内持久化 */ }} />
      </FormSection>
    </div>
  );
};

export default BasicSettingsPanel;