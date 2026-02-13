import React, { useEffect, useCallback, useRef } from "react";

import pkg from "../../../../package.json";
import { getAppSettings, APP_SETTINGS_KEY } from "../../../utils/appSettings";
import { FormSection, FormButton, FormButtonGroup } from "../../FormComponents";
import { TrashIcon, SaveIcon, FileIcon } from "../../Icons";
import styles from "../SettingsPanel.module.css";

// 版本建议优先从环境变量（vite.config 注入）读取，回退到 package.json
const appVersion = import.meta.env.VITE_APP_VERSION;

export interface AboutSettingsPanelProps {
  onRegisterSave?: (fn: () => void) => void;
}

const AboutSettingsPanel: React.FC<AboutSettingsPanelProps> = ({ onRegisterSave }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
   * 导出设置
   */
  const handleExportSettings = useCallback(() => {
    try {
      const settings = getAppSettings();
      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "immersive-clock-settings.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("导出设置失败:", err);
      alert("导出设置失败，请稍后重试。");
    }
  }, []);

  /**
   * 触发文件选择
   */
  const handleTriggerImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * 导入设置
   */
  const handleImportSettings = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 清除 value，以便重复选择同一文件触发 onChange
    event.target.value = "";

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        if (typeof result !== "string") return;

        const importedSettings = JSON.parse(result);

        // 简单校验：检查是否为对象且包含基本字段
        if (typeof importedSettings !== "object" || !importedSettings) {
          throw new Error("无效的设置文件格式");
        }

        const ok = window.confirm("确定要导入该设置文件吗？这将覆盖当前的配置并刷新页面。");
        if (!ok) return;

        localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(importedSettings));
        alert("设置导入成功，页面将刷新。");
        window.location.reload();
      } catch (err) {
        console.error("导入设置失败:", err);
        alert("导入设置失败：文件格式错误或内容无效。");
      }
    };
    reader.readAsText(file);
  }, []);

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
    <div id="about-panel" role="tabpanel" aria-labelledby="about">
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

      <FormSection title="设置管理">
        <p className={styles.helpText}>您可以导出当前设置进行备份，或导入之前的设置文件。</p>
        <FormButtonGroup align="left">
          <FormButton
            variant="secondary"
            size="md"
            onClick={handleExportSettings}
            icon={<SaveIcon size={16} />}
            aria-label="导出设置"
          >
            导出设置
          </FormButton>
          <FormButton
            variant="secondary"
            size="md"
            onClick={handleTriggerImport}
            icon={<FileIcon size={16} />}
            aria-label="导入设置"
          >
            导入设置
          </FormButton>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportSettings}
            accept=".json"
            style={{ display: "none" }}
            aria-hidden="true"
          />
        </FormButtonGroup>
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
