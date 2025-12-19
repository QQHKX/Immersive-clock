import React, { useState, useEffect } from "react";

import { useAppState, useAppDispatch } from "../../../contexts/AppContext";
import { FormSection, FormCheckbox, FormButton, FormButtonGroup } from "../../FormComponents";
import MessagePopup from "../../MessagePopup/MessagePopup";
import styles from "../SettingsPanel.module.css";

export interface MessagePopupSettingsPanelProps {
  onRegisterSave?: (fn: () => void) => void;
}

/**
 * 消息弹窗设置分区
 * - 开关：启用/禁用消息弹窗（持久化）
 * - 预览：显示默认样式弹窗，演示动画与关闭交互
 */
const MessagePopupSettingsPanel: React.FC<MessagePopupSettingsPanelProps> = ({
  onRegisterSave,
}) => {
  const { study } = useAppState();
  const dispatch = useAppDispatch();

  const [enabled, setEnabled] = useState<boolean>(!!study.messagePopupEnabled);
  const [weatherAlertEnabled, setWeatherAlertEnabled] = useState<boolean>(
    !!study.weatherAlertEnabled
  );
  const [minutelyPrecipEnabled, setMinutelyPrecipEnabled] = useState<boolean>(
    !!study.minutelyPrecipEnabled
  );
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<{
    type: "general" | "weatherAlert" | "coolingReminder" | "systemUpdate";
    title: string;
    message: string;
  } | null>(null);
  // 测试按钮通过全局事件触发弹窗，避免设置面板关闭时被卸载

  useEffect(() => {
    onRegisterSave?.(() => {
      dispatch({ type: "SET_MESSAGE_POPUP_ENABLED", payload: enabled });
      dispatch({ type: "SET_WEATHER_ALERT_ENABLED", payload: weatherAlertEnabled });
      dispatch({ type: "SET_MINUTELY_PRECIP_ENABLED", payload: minutelyPrecipEnabled });
    });
  }, [onRegisterSave, dispatch, enabled, weatherAlertEnabled, minutelyPrecipEnabled]);

  return (
    <div
      className={styles.settingsGroup}
      id="message-popup-panel"
      role="tabpanel"
      aria-labelledby="messages"
    >
      <h3 className={styles.groupTitle}>消息弹窗</h3>

      <FormSection title="基础设置">
        <FormCheckbox
          label="启用消息弹窗beta"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <p className={styles.helpText}>
          开启后，系统可在适当时机显示消息提醒。未来将支持天气灾害、降温提醒、系统更新等特殊类型。
        </p>

        <FormButtonGroup align="left">
          <FormButton variant="secondary" onClick={() => setPreviewOpen(true)} disabled={!enabled}>
            预览默认样式
          </FormButton>
        </FormButtonGroup>
      </FormSection>

      <FormSection title="天气提醒">
        <FormCheckbox
          label="天气预警弹窗"
          checked={weatherAlertEnabled}
          onChange={(e) => setWeatherAlertEnabled(e.target.checked)}
          disabled={!enabled}
        />
        <FormCheckbox
          label="降雨提醒弹窗"
          checked={minutelyPrecipEnabled}
          onChange={(e) => setMinutelyPrecipEnabled(e.target.checked)}
          disabled={!enabled}
        />
        <FormButtonGroup align="left">
          <FormButton
            variant="secondary"
            size="sm"
            onClick={() => {
              const ev = new CustomEvent("weatherMinutelyPrecipRefresh", {
                detail: { forceApi: true, openIfRain: false },
              });
              window.dispatchEvent(ev);
            }}
            disabled={!enabled || !minutelyPrecipEnabled}
          >
            刷新降雨数据
          </FormButton>
          <FormButton
            variant="secondary"
            onClick={() => {
              const ev = new CustomEvent("messagePopup:open", {
                detail: {
                  type: "weatherAlert",
                  title: "测试：天气预警",
                  message: "这是模拟的天气预警消息。实际使用将展示和风天气预警的标题与描述。",
                },
              });
              window.dispatchEvent(ev);
              setPreviewData({
                type: "weatherAlert",
                title: "测试：天气预警",
                message: "这是模拟的天气预警消息。实际使用将展示和风天气预警的标题与描述。",
              });
              setPreviewOpen(true);
            }}
            disabled={!enabled || !weatherAlertEnabled}
          >
            测试天气预警弹窗
          </FormButton>
          <FormButton
            variant="secondary"
            onClick={() => {
              const ev = new CustomEvent("messagePopup:open", {
                detail: {
                  type: "weatherAlert",
                  title: "测试：降雨提醒",
                  message: "这是模拟的降雨提醒。实际使用将根据分钟级降水返回的 summary 展示提示。",
                },
              });
              window.dispatchEvent(ev);
              setPreviewData({
                type: "weatherAlert",
                title: "测试：降雨提醒",
                message: "这是模拟的降雨提醒。实际使用将根据分钟级降水返回的 summary 展示提示。",
              });
              setPreviewOpen(true);
            }}
            disabled={!enabled || !minutelyPrecipEnabled}
          >
            测试降雨提醒弹窗
          </FormButton>
        </FormButtonGroup>
      </FormSection>

      {/* 预览区域：展示默认样式的消息弹窗（设置页内联渲染） */}
      {enabled && (
        <div aria-label="消息弹窗预览区" style={{ position: "relative", minHeight: 80 }}>
          {previewOpen && (
            <MessagePopup
              isOpen={previewOpen}
              onClose={() => setPreviewOpen(false)}
              type={previewData?.type ?? "general"}
              title={previewData?.title ?? "消息提醒"}
              message={previewData?.message ?? "这是一个通用的消息弹窗示例。点击左上角 × 可关闭。"}
              usePortal={false}
            />
          )}
          {/* 测试弹窗改为通过全局事件触发 */}
        </div>
      )}
    </div>
  );
};

export default MessagePopupSettingsPanel;
