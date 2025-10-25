import React, { useCallback } from 'react';
import styles from '../SettingsPanel.module.css';
import { FormSection, FormSlider } from '../../FormComponents';
import { QuoteChannelManager } from '../../QuoteChannelManager';
import { useAppState, useAppDispatch } from '../../../contexts/AppContext';

/**
 * 内容设置分段组件属性
 */
export interface ContentSettingsPanelProps {
  onRegisterSave?: (fn: () => void) => void;
}

/**
 * 内容管理分段组件
 * - 金句自动刷新频率
 * - 金句渠道管理
 */
/**
 * 内容管理分段组件
 * - 金句自动刷新间隔设置
 * - 频道管理
 */
export const ContentSettingsPanel: React.FC<ContentSettingsPanelProps> = ({ onRegisterSave }) => {
  const { quoteSettings } = useAppState();
  const dispatch = useAppDispatch();
  const [draftInterval, setDraftInterval] = React.useState<number>(quoteSettings.autoRefreshInterval);
  const channelSaveRef = React.useRef<(() => void) | null>(null);

  const formatRefreshIntervalText = useCallback((seconds: number): string => {
    if (seconds === 0) return '手动刷新';
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds === 0 ? `${minutes}分钟` : `${minutes}分${remainingSeconds}秒`;
  }, []);

  const handleQuoteRefreshIntervalChange = useCallback((value: number) => {
    setDraftInterval(value);
  }, []);

  React.useEffect(() => {
    onRegisterSave?.(() => {
      // 保存刷新间隔
      dispatch({ type: 'SET_QUOTE_AUTO_REFRESH_INTERVAL', payload: draftInterval });
      // 保存渠道草稿
      channelSaveRef.current?.();
    });
  }, [onRegisterSave, draftInterval, dispatch]);

  return (
    <div className={styles.settingsGroup} id="content-panel" role="tabpanel" aria-labelledby="content">
      <h3 className={styles.groupTitle}>金句设置</h3>
      <FormSection title="金句自动刷新">
        <div className={styles.quoteRefreshInfo}>
          <p className={styles.infoText}>当前设置: {formatRefreshIntervalText(draftInterval)}</p>
          <p className={styles.helpText}>调节金句的自动刷新频率，左端为最短间隔30秒，右端为关闭自动刷新。</p>
        </div>
        <FormSlider
          label="刷新频率"
          value={draftInterval}
          min={30}
          max={1800}
          step={30}
          onChange={handleQuoteRefreshIntervalChange}
          formatValue={formatRefreshIntervalText}
          showRange={true}
          rangeLabels={['30秒', '手动刷新']}
        />
      </FormSection>

      <QuoteChannelManager onRegisterSave={(fn) => { channelSaveRef.current = fn; }} />
    </div>
  );
};

export default ContentSettingsPanel;