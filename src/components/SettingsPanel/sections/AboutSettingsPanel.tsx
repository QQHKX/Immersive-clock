import React, { useEffect, useCallback, useRef, useState } from "react";

import pkg from "../../../../package.json";
import { getAppSettings, APP_SETTINGS_KEY, resetAppSettings } from "../../../utils/appSettings";
import { db } from "../../../utils/db";
import { clearNoiseSlices } from "../../../utils/noiseSliceService";
import { clearWeatherCache } from "../../../utils/weatherStorage";
import { FormSection, FormButton, FormButtonGroup, FormSelect } from "../../FormComponents";
import { TrashIcon, SaveIcon, FileIcon } from "../../Icons";
import styles from "../SettingsPanel.module.css";

// 版本建议优先从环境变量（vite.config 注入）读取，回退到 package.json
const appVersion = import.meta.env.VITE_APP_VERSION;

export interface AboutSettingsPanelProps {
  onRegisterSave?: (fn: () => void) => void;
}

const AboutSettingsPanel: React.FC<AboutSettingsPanelProps> = ({ onRegisterSave }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedClearOption, setSelectedClearOption] = useState<string>("all");

  const clearOptions = [
    { value: "all", label: "全部清理（重置所有设置与数据）" },
    { value: "settings", label: "仅清理设置（保留噪音/天气缓存）" },
    { value: "noise", label: "仅清理噪音历史数据" },
    { value: "weather", label: "仅清理天气缓存" },
  ];

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
   * 仅清理 AppSettings（保留噪音历史/天气缓存）
   */
  const handleClearSettingsOnly = useCallback(() => {
    const ok = window.confirm(
      "确定要恢复默认设置吗？该操作将重置所有设置，但保留噪音历史和天气缓存。"
    );
    if (!ok) return;
    try {
      resetAppSettings();
      alert("已恢复默认设置。建议刷新页面以确保设置生效。");
    } catch (err) {
      console.error("重置设置失败:", err);
      alert("重置设置失败，请稍后重试。");
    }
  }, []);

  /**
   * 仅清理噪音历史数据
   */
  const handleClearNoiseOnly = useCallback(() => {
    const ok = window.confirm("确定要清除噪音历史数据吗？该操作不影响其他数据。");
    if (!ok) return;
    try {
      clearNoiseSlices();
      alert("已清除噪音历史数据。");
    } catch (err) {
      console.error("清除噪音历史失败:", err);
      alert("清除噪音历史失败，请稍后重试。");
    }
  }, []);

  /**
   * 仅清理天气缓存
   */
  const handleClearWeatherOnly = useCallback(() => {
    const ok = window.confirm("确定要清除天气缓存吗？该操作不影响其他数据。");
    if (!ok) return;
    try {
      clearWeatherCache();
      alert("已清除天气缓存。天气信息将在下次刷新时重新获取。");
    } catch (err) {
      console.error("清除天气缓存失败:", err);
      alert("清除天气缓存失败，请稍后重试。");
    }
  }, []);

  /**
   * 清除 IndexedDB 中的自定义字体数据
   */
  const handleClearIndexedDB = useCallback(async () => {
    try {
      await db.clear();
    } catch (err) {
      console.error("清除 IndexedDB 失败:", err);
    }
  }, []);

  /**
   * 清除所有本地缓存
   * - 提示确认，避免误操作
   * - 清理后不会自动刷新页面，用户可手动刷新生效
   */
  const handleClearAll = useCallback(async () => {
    const ok = window.confirm(
      "确定要清除所有本地缓存吗？该操作将重置所有设置与数据（包括自定义字体），且无法恢复。"
    );
    if (!ok) return;
    try {
      localStorage.clear();
      await handleClearIndexedDB();
      alert("已清除所有缓存。建议刷新页面以确保设置重置。");
    } catch (err) {
      console.error("清除缓存失败:", err);
      alert("清除缓存失败，请稍后重试。");
    }
  }, [handleClearIndexedDB]);

  /**
   * 根据选择执行相应的清理操作
   */
  const handleClearCaches = useCallback(() => {
    switch (selectedClearOption) {
      case "settings":
        handleClearSettingsOnly();
        break;
      case "noise":
        handleClearNoiseOnly();
        break;
      case "weather":
        handleClearWeatherOnly();
        break;
      case "all":
      default:
        handleClearAll();
        break;
    }
  }, [
    selectedClearOption,
    handleClearSettingsOnly,
    handleClearNoiseOnly,
    handleClearWeatherOnly,
    handleClearAll,
  ]);

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
        <p className={styles.helpText}>
          如遇到设置异常或数据问题，可尝试清理本地缓存。请选择清理范围后执行操作。
        </p>
        <FormSelect
          label="清理范围"
          value={selectedClearOption}
          options={clearOptions}
          onChange={(value) => setSelectedClearOption(value)}
        />
        <FormButtonGroup align="left">
          <FormButton
            variant={selectedClearOption === "all" ? "danger" : "secondary"}
            size="md"
            onClick={handleClearCaches}
            icon={<TrashIcon size={16} />}
            aria-label="执行清理操作"
            title={
              selectedClearOption === "all"
                ? "清除所有缓存"
                : selectedClearOption === "settings"
                  ? "恢复默认设置"
                  : selectedClearOption === "noise"
                    ? "清除噪音历史"
                    : "清除天气缓存"
            }
          >
            {selectedClearOption === "all"
              ? "清除所有缓存"
              : selectedClearOption === "settings"
                ? "恢复默认设置"
                : selectedClearOption === "noise"
                  ? "清除噪音历史"
                  : "清除天气缓存"}
          </FormButton>
        </FormButtonGroup>
      </FormSection>
    </div>
  );
};

export default AboutSettingsPanel;
