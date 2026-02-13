import React, { useCallback } from "react";

import { useAppState, useAppDispatch } from "../../../contexts/AppContext";
import { FormSection, FormSlider } from "../../FormComponents";
import { QuoteChannelManager } from "../../QuoteChannelManager";
import styles from "../SettingsPanel.module.css";

/**
 * 内容设置分段组件属性
 */
export interface ContentSettingsPanelProps {
  onRegisterSave?: (fn: () => void) => void;
}

/**
 * 内容管理分段组件
 * - 语录自动刷新间隔设置
 * - 频道管理
 */
export const ContentSettingsPanel: React.FC<ContentSettingsPanelProps> = ({ onRegisterSave }) => {
  const { quoteSettings } = useAppState();
  const dispatch = useAppDispatch();
  const [draftInterval, setDraftInterval] = React.useState<number>(
    quoteSettings.autoRefreshInterval
  );
  const channelSaveRef = React.useRef<(() => void) | null>(null);

  const formatRefreshIntervalText = useCallback((seconds: number): string => {
    if (seconds === 0) return "手动刷新";
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
      dispatch({ type: "SET_QUOTE_AUTO_REFRESH_INTERVAL", payload: draftInterval });
      // 保存渠道草稿
      channelSaveRef.current?.();
    });
  }, [onRegisterSave, draftInterval, dispatch]);

  return (
    <div id="content-panel" role="tabpanel" aria-labelledby="content">
      <FormSection title="语录自动刷新">
        <div className={styles.sliderWithInfo}>
          <div className={styles.sliderWrapper}>
            <FormSlider
              label="刷新频率"
              value={draftInterval}
              min={30}
              max={1800}
              step={30}
              onChange={handleQuoteRefreshIntervalChange}
              formatValue={formatRefreshIntervalText}
              showRange={true}
              rangeLabels={["30秒", "手动刷新"]}
            />
          </div>
          <p className={styles.infoSide}>
            调节语录的自动刷新频率，左端为最短间隔30秒，右端为关闭自动刷新。
          </p>
        </div>
      </FormSection>

      <QuoteChannelManager
        onRegisterSave={(fn) => {
          channelSaveRef.current = fn;
        }}
      />
    </div>
  );
};

export default ContentSettingsPanel;
