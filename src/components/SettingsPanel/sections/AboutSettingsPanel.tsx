import React, { useEffect, useCallback } from "react";

import pkg from "../../../../package.json";
import { FormSection, FormButton, FormButtonGroup } from "../../FormComponents";
import { TrashIcon } from "../../Icons";
import styles from "../SettingsPanel.module.css";
// 版本建议优先从环境变量（vite.config 注入）读取，回退到 package.json
const appVersion = import.meta.env.VITE_APP_VERSION;

export interface AboutSettingsPanelProps {
  onRegisterSave?: (fn: () => void) => void;
}

const AboutSettingsPanel: React.FC<AboutSettingsPanelProps> = ({ onRegisterSave }) => {
  useEffect(() => {
    // 关于页无保存逻辑，注册一个空操作以保持接口一致性
    if (onRegisterSave) {
      onRegisterSave(() => {});
    }
  }, [onRegisterSave]);

  const version = (appVersion && String(appVersion)) || pkg.version;
  const license = pkg.license || "MIT";
  const authorSite = pkg.homepage || "https://qqhkx.com";
  const repoUrl = "https://github.com/QQHKX/immersive-clock";

  /**
   * 清除所有本地缓存（localStorage）
   * - 提示确认，避免误操作
   * - 清理后不会自动刷新页面，用户可手动刷新生效
   */
  const handleClearCaches = useCallback(() => {
    const ok = window.confirm("确定要清除所有本地缓存吗？该操作将重置设置与本地数据。");
    if (!ok) return;
    try {
      // 直接清空 localStorage，覆盖项目内所有键
      localStorage.clear();
      alert("已清除所有缓存。建议刷新页面以确保设置重置。");
    } catch (err) {
      console.error("清除缓存失败:", err);
      alert("清除缓存失败，请稍后重试。");
    }
  }, []);

  return (
    <div className={styles.settingsGroup} id="about-panel" role="tabpanel" aria-labelledby="about">
      <h3 className={styles.groupTitle}>关于</h3>

      <FormSection title="项目信息">
        <p className={styles.infoText}>版本：v{version}</p>
        <p className={styles.infoText}>版权：{license} License</p>
        <p className={styles.infoText}>
          作者网站：
          <a href={authorSite} target="_blank" rel="noopener noreferrer">
            {authorSite}
          </a>
        </p>
        <p className={styles.infoText}>
          开源地址：
          <a href={repoUrl} target="_blank" rel="noopener noreferrer">
            {repoUrl}
          </a>
        </p>
      </FormSection>

      <FormSection title="使用声明">
        <p className={styles.infoText}>本软件为开源软件，严禁倒卖商用。</p>
      </FormSection>

      <FormSection title="缓存与重置">
        <p className={styles.helpText}>如遇到设置异常或数据问题，可尝试清理本地缓存。</p>
        <FormButtonGroup align="left">
          <FormButton
            variant="danger"
            size="md"
            onClick={handleClearCaches}
            icon={<TrashIcon size={16} />}
            aria-label="清除所有缓存"
            title="清除所有缓存"
          >
            清除所有缓存
          </FormButton>
        </FormButtonGroup>
      </FormSection>
    </div>
  );
};

export default AboutSettingsPanel;
