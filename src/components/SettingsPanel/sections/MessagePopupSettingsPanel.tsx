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
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  useEffect(() => {
    onRegisterSave?.(() => {
      dispatch({ type: "SET_MESSAGE_POPUP_ENABLED", payload: enabled });
    });
  }, [onRegisterSave, dispatch, enabled]);

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

      {/* 预览区域：展示默认样式的消息弹窗（设置页内联渲染） */}
      {enabled && (
        <div aria-label="消息弹窗预览区" style={{ position: "relative", minHeight: 80 }}>
          {previewOpen && (
            <MessagePopup
              isOpen={previewOpen}
              onClose={() => setPreviewOpen(false)}
              type="general"
              title="消息提醒"
              message="这是一个通用的消息弹窗示例。点击左上角 × 可关闭。"
              usePortal={false}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default MessagePopupSettingsPanel;
