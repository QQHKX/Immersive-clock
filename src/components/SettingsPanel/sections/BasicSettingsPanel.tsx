import React, { useCallback, useEffect, useState } from 'react';
import { useAppState, useAppDispatch } from '../../../contexts/AppContext';
import { FormSection, FormInput, FormSegmented, FormButton, FormButtonGroup, FormCheckbox, FormRow, FormSlider } from '../../FormComponents';
import styles from '../SettingsPanel.module.css';
import ScheduleSettings from '../../ScheduleSettings';
import { readStudyBackground, saveStudyBackground } from '../../../utils/studyBackgroundStorage';
import { CountdownManagerPanel } from './CountdownManagerPanel';
import { CountdownItem } from '../../../types';

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

  // 倒计时模式（重构）：'gaokao' | 'single' | 'multi'
  const [countdownMode, setCountdownMode] = useState<'gaokao' | 'single' | 'multi'>('gaokao');

  // 倒计时设置草稿（保留兼容字段）
  const [draftCountdownType, setDraftCountdownType] = useState<'gaokao' | 'custom'>(study.countdownType ?? 'gaokao');
  const [draftCustomName, setDraftCustomName] = useState<string>(study.customName ?? '');
  const [draftCustomDate, setDraftCustomDate] = useState<string>(study.customDate ?? '');
  const [singleBgColor, setSingleBgColor] = useState<string>('');
  const [singleTextColor, setSingleTextColor] = useState<string>('');
  // 新增：轮播间隔（秒）与倒计时数字颜色（全局覆盖）
  const [carouselIntervalSec, setCarouselIntervalSec] = useState<number>(study.carouselIntervalSec ?? 6);
  const [digitColor, setDigitColor] = useState<string>(study.digitColor ?? '');

  // 晚自习组件显示草稿（时间始终显示，不提供开关）
  const defaultDisplay = { showStatusBar: true, showNoiseMonitor: true, showCountdown: true, showQuote: true, showTime: true, showDate: true };
  const [draftDisplay, setDraftDisplay] = useState<typeof defaultDisplay>({ ...(study.display || defaultDisplay) });

  // 背景设置草稿
  const [bgType, setBgType] = useState<'default' | 'color' | 'image'>('default');
  const [bgColor, setBgColor] = useState<string>('#121212');
  const [bgAlpha, setBgAlpha] = useState<number>(1);
  const [bgImage, setBgImage] = useState<string | null>(null);

  // 课表设置弹窗
  const [scheduleOpen, setScheduleOpen] = useState<boolean>(false);

  // 子分区保存注册
  const countdownSaveRef = React.useRef<() => void>(() => { });

  // 单事件颜色透明度草稿
  const [singleBgOpacity, setSingleBgOpacity] = useState<number>(0);
  const [singleTextOpacity, setSingleTextOpacity] = useState<number>(1);
  // 全局数字透明度草稿
  const [digitOpacity, setDigitOpacity] = useState<number>(1);

  // 恢复默认：切回高考模式、清空单项颜色与自定义信息、重置最近高考年
  const resetCountdownDefaults = useCallback(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const thisYearGaokao = new Date(currentYear, 5, 7);
    const nearestYear = now > thisYearGaokao ? currentYear + 1 : currentYear;

    setCountdownMode('gaokao');
    try { localStorage.setItem('countdown-mode', 'gaokao'); } catch { }
    setSingleBgColor('');
    setSingleTextColor('');
    setSingleBgOpacity(0);
    setSingleTextOpacity(1);
    setDraftCustomName('');
    setDraftCustomDate('');
    onTargetYearChange?.(nearestYear);
  }, [onTargetYearChange]);

  // 打开时优先从本地存储读取上次选择的倒计时模式
  useEffect(() => {
    try {
      const saved = localStorage.getItem('countdown-mode');
      if (saved === 'gaokao' || saved === 'single' || saved === 'multi') {
        setCountdownMode(saved as 'gaokao' | 'single' | 'multi');
      }
    } catch { }
  }, []);

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
    setBgAlpha(typeof bg.colorAlpha === 'number' ? bg.colorAlpha : 1);
    setBgImage(bg.imageDataUrl ?? null);

    // 根据现有 countdownItems 推断模式，并填充单项颜色
    const items = (study.countdownItems || []);
    if (Array.isArray(items) && items.length > 1) {
      setCountdownMode('multi');
      setSingleBgColor('');
      setSingleTextColor('');
      setSingleBgOpacity(0);
      setSingleTextOpacity(1);
    } else if (Array.isArray(items) && items.length === 1) {
      const it = items[0];
      if (it.kind === 'gaokao') {
        setCountdownMode('gaokao');
        setSingleBgColor(it.bgColor || '');
        setSingleTextColor(it.textColor || '');
        setSingleBgOpacity(typeof it.bgOpacity === 'number' ? it.bgOpacity : 0);
        setSingleTextOpacity(typeof it.textOpacity === 'number' ? it.textOpacity : 1);
        // 名称可编辑但不需要日期
        setDraftCustomName(it.name || '');
        setDraftCustomDate('');
      } else {
        setCountdownMode('single');
        setDraftCustomName(it.name || study.customName || '');
        setDraftCustomDate(it.targetDate || study.customDate || '');
        setSingleBgColor(it.bgColor || '');
        setSingleTextColor(it.textColor || '');
        setSingleBgOpacity(typeof it.bgOpacity === 'number' ? it.bgOpacity : 0);
        setSingleTextOpacity(typeof it.textOpacity === 'number' ? it.textOpacity : 1);
      }
    } else {
      // 兼容旧逻辑：无 items 时用 countdownType 决定模式
      setCountdownMode((study.countdownType ?? 'gaokao') === 'gaokao' ? 'gaokao' : 'single');
      setSingleBgColor('');
      setSingleTextColor('');
      setSingleBgOpacity(0);
      setSingleTextOpacity(1);
    }
    setDigitOpacity(typeof study.digitOpacity === 'number' ? study.digitOpacity : 1);
  }, [study.countdownType, study.customName, study.customDate, study.display, study.countdownItems, study.digitOpacity]);

  // 注册保存动作：统一在父组件保存时派发
  useEffect(() => {
    onRegisterSave?.(() => {
      // 倒计时模式映射到旧字段：多事件作为自定义类型
      const nextType: 'gaokao' | 'custom' = countdownMode === 'gaokao' ? 'gaokao' : 'custom';
      dispatch({ type: 'SET_COUNTDOWN_TYPE', payload: nextType });

      // 单事件时更新旧字段（用于兼容回退显示）
      if (countdownMode === 'single') {
        dispatch({ type: 'SET_CUSTOM_COUNTDOWN', payload: { name: draftCustomName, date: draftCustomDate } });
      }

      // 保存组件显示设置（强制时间显示）
      dispatch({ type: 'SET_STUDY_DISPLAY', payload: { ...draftDisplay, showTime: true } });
      // 保存轮播间隔与数字颜色（多事件不再统一修改数字颜色）
      if (countdownMode === 'multi') {
        dispatch({ type: 'SET_CAROUSEL_INTERVAL', payload: carouselIntervalSec });
      } else {
        dispatch({ type: 'SET_COUNTDOWN_DIGIT_COLOR', payload: digitColor || undefined });
        dispatch({ type: 'SET_COUNTDOWN_DIGIT_OPACITY', payload: digitOpacity });
      }
      // 保存背景设置
      saveStudyBackground({
        type: bgType,
        color: bgType === 'color' ? bgColor : undefined,
        colorAlpha: bgType === 'color' ? bgAlpha : undefined,
        imageDataUrl: bgType === 'image' ? (bgImage ?? undefined) : undefined,
      });
      // 通知学习页面刷新背景
      window.dispatchEvent(new CustomEvent('study-background-updated'));

      // 保存倒计时项目
      if (countdownMode === 'gaokao') {
        const one: CountdownItem[] = [{ id: 'gaokao-default', kind: 'gaokao', name: '高考倒计时', bgColor: singleBgColor || undefined, bgOpacity: singleBgOpacity, textColor: singleTextColor || undefined, textOpacity: singleTextOpacity, order: 0 }];
        dispatch({ type: 'SET_COUNTDOWN_ITEMS', payload: one });
      } else if (countdownMode === 'single') {
        const one: CountdownItem[] = [{ id: 'custom-default', kind: 'custom', name: (draftCustomName && draftCustomName.trim()) || '自定义事件', targetDate: (draftCustomDate && draftCustomDate.trim()) || '', bgColor: singleBgColor || undefined, bgOpacity: singleBgOpacity, textColor: singleTextColor || undefined, textOpacity: singleTextOpacity, order: 0 }];
        dispatch({ type: 'SET_COUNTDOWN_ITEMS', payload: one });
      } else {
        // 多事件：由子面板负责收集并保存
        countdownSaveRef.current?.();
      }
      // 记录最近启用的模式，确保下次打开直接显示
      try { localStorage.setItem('countdown-mode', countdownMode); } catch { }
    });
  }, [onRegisterSave, countdownMode, draftCustomName, draftCustomDate, draftDisplay, carouselIntervalSec, digitColor, digitOpacity, bgType, bgColor, bgAlpha, bgImage, singleBgColor, singleTextColor, singleBgOpacity, singleTextOpacity, dispatch]);

  return (
    <div className={styles.settingsGroup} id="basic-panel" role="tabpanel" aria-labelledby="basic">
      {/* 显示设置分区已前移到倒计时设置之前 */}

      {/* 倒计时设置 */}
      <FormSection title="倒计时设置">
        <FormSegmented
          label="模式"
          value={countdownMode}
          options={[
            { label: '高考', value: 'gaokao' },
            { label: '单事件', value: 'single' },
            { label: '多事件', value: 'multi' },
          ]}
          onChange={(v) => setCountdownMode(v as 'gaokao' | 'single' | 'multi')}
        />

        {countdownMode === 'multi' && (
          <FormRow gap="sm" align="center">
            <FormSlider
              label="轮播间隔"
              min={1}
              max={60}
              step={1}
              value={carouselIntervalSec}
              onChange={(v) => setCarouselIntervalSec(Math.round(v))}
              formatValue={(v) => `${Math.round(v)} 秒`}
              rangeLabels={[`1 秒`, `60 秒`]}
            />
          </FormRow>
        )}

        {countdownMode === 'gaokao' && (
          <>
            <p className={styles.helpText}>使用高考日期（6月7日）自动计算，支持自定义目标年份。</p>
            <FormRow gap="sm" align="center">
              <FormInput
                label="目标年份"
                type="number"
                variant="number"
                value={String(targetYear)}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isNaN(v)) onTargetYearChange?.(v);
                }}
                min={1900}
                max={2100}
                step={1}
                placeholder="例如 2026"
              />
              <FormInput label="背景色" type="color" value={singleBgColor || '#121212'} onChange={(e) => setSingleBgColor(e.target.value)} style={{ width: 36, height: 36, padding: 0 }} />
              <FormSlider label="背景透明度" min={0} max={1} step={0.01} value={singleBgOpacity} onChange={(v) => setSingleBgOpacity(v)} formatValue={(v) => `${Math.round(v * 100)}%`} />
              <FormInput label="文字色" type="color" value={singleTextColor || '#E0E0E0'} onChange={(e) => setSingleTextColor(e.target.value)} style={{ width: 36, height: 36, padding: 0 }} />
              <FormSlider label="文字透明度" min={0} max={1} step={0.01} value={singleTextOpacity} onChange={(v) => setSingleTextOpacity(v)} formatValue={(v) => `${Math.round(v * 100)}%`} />
              <FormInput label="数字颜色" type="color" value={digitColor || '#03DAC6'} onChange={(e) => setDigitColor(e.target.value)} style={{ width: 36, height: 36, padding: 0 }} />
              <FormSlider label="数字透明度" min={0} max={1} step={0.01} value={digitOpacity} onChange={(v) => setDigitOpacity(v)} formatValue={(v) => `${Math.round(v * 100)}%`} />
            </FormRow>
          </>
        )}

        {countdownMode === 'single' && (
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
            <FormRow gap="sm" align="center">
              <FormInput label="背景色" type="color" value={singleBgColor || '#121212'} onChange={(e) => setSingleBgColor(e.target.value)} style={{ width: 36, height: 36, padding: 0 }} />
              <FormSlider label="背景透明度" min={0} max={1} step={0.01} value={singleBgOpacity} onChange={(v) => setSingleBgOpacity(v)} formatValue={(v) => `${Math.round(v * 100)}%`} />
              <FormInput label="文字色" type="color" value={singleTextColor || '#E0E0E0'} onChange={(e) => setSingleTextColor(e.target.value)} style={{ width: 36, height: 36, padding: 0 }} />
              <FormSlider label="文字透明度" min={0} max={1} step={0.01} value={singleTextOpacity} onChange={(v) => setSingleTextOpacity(v)} formatValue={(v) => `${Math.round(v * 100)}%`} />
              <FormInput label="数字颜色" type="color" value={digitColor || '#03DAC6'} onChange={(e) => setDigitColor(e.target.value)} style={{ width: 36, height: 36, padding: 0 }} />
              <FormSlider label="数字透明度" min={0} max={1} step={0.01} value={digitOpacity} onChange={(v) => setDigitOpacity(v)} formatValue={(v) => `${Math.round(v * 100)}%`} />
            </FormRow>
          </>
        )}

        {countdownMode === 'multi' && (
          <CountdownManagerPanel onRegisterSave={(fn) => { countdownSaveRef.current = fn; }} />
        )}
      </FormSection>

      <FormSection title="显示设置">
        <p className={styles.helpText}>选择晚自习页面显示的组件（时间始终显示）。</p>
        <FormRow gap="sm" align="center">
          <FormCheckbox label="状态栏" checked={!!draftDisplay.showStatusBar} onChange={(e) => setDraftDisplay((prev) => ({ ...prev, showStatusBar: e.target.checked }))} />
          <FormCheckbox label="噪音监测" checked={!!draftDisplay.showNoiseMonitor} onChange={(e) => setDraftDisplay((prev) => ({ ...prev, showNoiseMonitor: e.target.checked }))} />
          <FormCheckbox label="倒计时" checked={!!draftDisplay.showCountdown} onChange={(e) => setDraftDisplay((prev) => ({ ...prev, showCountdown: e.target.checked }))} />
          <FormCheckbox label="励志金句" checked={!!draftDisplay.showQuote} onChange={(e) => setDraftDisplay((prev) => ({ ...prev, showQuote: e.target.checked }))} />
          <FormCheckbox label="日期" checked={!!draftDisplay.showDate} onChange={(e) => setDraftDisplay((prev) => ({ ...prev, showDate: e.target.checked }))} />
        </FormRow>
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
              <FormInput type="text" value={bgColor} onChange={(e) => setBgColor(e.target.value)} placeholder="#121212" />
              <FormSlider label="背景透明度" min={0} max={1} step={0.01} value={bgAlpha} onChange={(v) => setBgAlpha(v)} formatValue={(v) => `${Math.round(v * 100)}%`} />
            </FormRow>
            <p className={styles.helpText}>支持调色盘或十六进制颜色代码（例如 #1a1a1a）。</p>
          </>
        )}

        {bgType === 'image' && (
          <>
            <FormRow gap="sm">
              <input type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setBgImage(reader.result as string);
                reader.readAsDataURL(file);
              }} />
            </FormRow>
            {bgImage && (
              <>
                <img src={bgImage} alt="背景预览" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #333' }} />
                <FormRow gap="sm">
                  <FormButton variant="secondary" onClick={() => setBgImage(null)}>移除图片</FormButton>
                </FormRow>
              </>
            )}
          </>
        )}

      </FormSection>

      <FormSection title="课表设置">
        <p className={styles.helpText}>在此管理晚自习课程时间段，保存后即时生效。</p>
        <FormButtonGroup align="left">
          <FormButton variant="primary" onClick={() => setScheduleOpen(true)}>打开课表设置</FormButton>
        </FormButtonGroup>
        <ScheduleSettings isOpen={scheduleOpen} onClose={() => setScheduleOpen(false)} onSave={() => { /* 已在弹窗内持久化 */ }} />
      </FormSection>
    </div>
  );
};

export default BasicSettingsPanel;