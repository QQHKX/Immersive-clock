import React, { useEffect, useCallback, useMemo, useRef, useState } from "react";

import pkg from "../../../../package.json";
import { useAppDispatch, useAppState } from "../../../contexts/AppContext";
import { getAppSettings, APP_SETTINGS_KEY } from "../../../utils/appSettings";
import {
  clearErrorCenter,
  exportErrorCenterJson,
  getErrorCenterRecords,
  subscribeErrorCenter,
  type ErrorCenterMode,
} from "../../../utils/errorCenter";
import { getWeatherCache } from "../../../utils/weatherStorage";
import {
  FormSection,
  FormButton,
  FormButtonGroup,
  FormCheckbox,
  FormRow,
  FormSegmented,
} from "../../FormComponents";
import { TrashIcon, SaveIcon, FileIcon } from "../../Icons";
import styles from "../SettingsPanel.module.css";

// 版本建议优先从环境变量（vite.config 注入）读取，回退到 package.json
const appVersion = import.meta.env.VITE_APP_VERSION;

export interface AboutSettingsPanelProps {
  onRegisterSave?: (fn: () => void) => void;
}

const AboutSettingsPanel: React.FC<AboutSettingsPanelProps> = ({ onRegisterSave }) => {
  const { study } = useAppState();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string>("");
  const [records, setRecords] = useState(() => getErrorCenterRecords().slice());
  const [levelFilter, setLevelFilter] = useState<"all" | "error" | "warn" | "info" | "debug">(
    "all"
  );
  const appliedErrorCenterMode = (study.errorCenterMode ?? "off") as ErrorCenterMode;
  const isErrorCenterActive = appliedErrorCenterMode !== "off";
  const [draftErrorPopupEnabled, setDraftErrorPopupEnabled] = useState<boolean>(
    !!study.errorPopupEnabled
  );
  const [draftErrorCenterMode, setDraftErrorCenterMode] =
    useState<ErrorCenterMode>(appliedErrorCenterMode);

  useEffect(() => {
    setDraftErrorPopupEnabled(!!study.errorPopupEnabled);
  }, [study.errorPopupEnabled]);

  useEffect(() => {
    setDraftErrorCenterMode(appliedErrorCenterMode);
  }, [appliedErrorCenterMode]);

  useEffect(() => {
    if (!onRegisterSave) return;
    onRegisterSave(() => {
      dispatch({ type: "SET_ERROR_POPUP_ENABLED", payload: draftErrorPopupEnabled });
      dispatch({ type: "SET_ERROR_CENTER_MODE", payload: draftErrorCenterMode });
    });
  }, [onRegisterSave, dispatch, draftErrorPopupEnabled, draftErrorCenterMode]);

  useEffect(() => {
    const off = subscribeErrorCenter((next) => {
      setRecords(next.slice());
    });
    return off;
  }, []);

  const version = (appVersion && String(appVersion)) || pkg.version;
  const license = pkg.license || "MIT";
  const authorSite = pkg.homepage || "https://qqhkx.com";
  const repoUrl = "https://github.com/QQHKX/immersive-clock";

  const envInfo = useMemo(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isElectron = (() => {
      try {
        return typeof navigator !== "undefined" && /electron/i.test(navigator.userAgent);
      } catch {
        return false;
      }
    })();
    return { ua, isElectron };
  }, []);

  const filteredRecords = useMemo(() => {
    const list = levelFilter === "all" ? records : records.filter((r) => r.level === levelFilter);
    return list.slice().reverse().slice(0, 50);
  }, [records, levelFilter]);

  /**
   * 导出设置
   */
  const handleExportSettings = useCallback(() => {
    try {
      setNotice("");
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
      setNotice(isErrorCenterActive ? "导出设置失败，已记录到“错误与调试”。" : "导出设置失败。");
      const msg = err instanceof Error ? err.message : String(err);
      window.dispatchEvent(
        new CustomEvent("messagePopup:open", {
          detail: { type: "error", title: "导出设置失败", message: msg },
        })
      );
    }
  }, [isErrorCenterActive]);

  /**
   * 触发文件选择
   */
  const handleTriggerImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * 导入设置
   */
  const handleImportSettings = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // 清除 value，以便重复选择同一文件触发 onChange
      event.target.value = "";

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          setNotice("");
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
          setNotice(
            isErrorCenterActive ? "导入设置失败，已记录到“错误与调试”。" : "导入设置失败。"
          );
          const msg = err instanceof Error ? err.message : String(err);
          window.dispatchEvent(
            new CustomEvent("messagePopup:open", {
              detail: { type: "error", title: "导入设置失败", message: msg },
            })
          );
        }
      };
      reader.readAsText(file);
    },
    [isErrorCenterActive]
  );

  /**
   * 清除所有本地缓存（localStorage）
   * - 提示确认，避免误操作
   * - 清理后不会自动刷新页面，用户可手动刷新生效
   */
  const handleClearCaches = useCallback(() => {
    const ok = window.confirm("确定要清除所有本地缓存吗？该操作将重置设置与本地数据。");
    if (!ok) return;
    try {
      setNotice("");
      // 直接清空 localStorage，覆盖项目内所有键
      localStorage.clear();
      alert("已清除所有缓存。建议刷新页面以确保设置重置。");
    } catch (err) {
      setNotice(isErrorCenterActive ? "清除缓存失败，已记录到“错误与调试”。" : "清除缓存失败。");
      const msg = err instanceof Error ? err.message : String(err);
      window.dispatchEvent(
        new CustomEvent("messagePopup:open", {
          detail: { type: "error", title: "清除缓存失败", message: msg },
        })
      );
    }
  }, [isErrorCenterActive]);

  const handleClearErrorRecords = useCallback(() => {
    setNotice("");
    clearErrorCenter();
    setNotice("已清空错误记录。");
  }, []);

  const handleExportErrorRecords = useCallback(() => {
    setNotice("");
    try {
      const text = exportErrorCenterJson();
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "immersive-clock-error-records.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setNotice("导出错误记录失败。");
      const msg = err instanceof Error ? err.message : String(err);
      window.dispatchEvent(
        new CustomEvent("messagePopup:open", {
          detail: { type: "error", title: "导出错误记录失败", message: msg },
        })
      );
    }
  }, []);

  const handleCopyErrorSummary = useCallback(async () => {
    setNotice("");
    const lines = records
      .slice()
      .reverse()
      .slice(0, 50)
      .map((r) => {
        const t = new Date(r.ts).toLocaleString();
        return `[${t}] ${r.level.toUpperCase()} ${r.source} ${r.title} x${r.count} - ${r.message}`;
      })
      .join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      setNotice("已复制错误摘要到剪贴板。");
    } catch {
      setNotice("复制失败（浏览器可能未授予剪贴板权限）。");
    }
  }, [records]);

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

      <FormSection title="错误与调试">
        <FormRow gap="sm" align="center">
          <FormCheckbox
            label="错误弹窗提示"
            checked={draftErrorPopupEnabled}
            onChange={(e) => {
              setDraftErrorPopupEnabled(e.target.checked);
            }}
          />
        </FormRow>

        <FormRow gap="sm" align="center">
          <FormSegmented
            label="记录方式"
            value={draftErrorCenterMode}
            options={[
              { label: "关闭", value: "off" },
              { label: "仅内存", value: "memory" },
              { label: "持久化", value: "persist" },
            ]}
            onChange={(v) => setDraftErrorCenterMode(v as ErrorCenterMode)}
          />
        </FormRow>

        {isErrorCenterActive ? (
          <>
            <FormRow gap="sm" align="center">
              <FormSegmented
                label="级别筛选"
                value={levelFilter}
                options={[
                  { label: "全部", value: "all" },
                  { label: "错误", value: "error" },
                  { label: "告警", value: "warn" },
                  { label: "信息", value: "info" },
                ]}
                onChange={(v) => setLevelFilter(v as typeof levelFilter)}
              />
            </FormRow>

            <FormButtonGroup align="left">
              <FormButton variant="secondary" size="md" onClick={handleCopyErrorSummary}>
                复制摘要
              </FormButton>
              <FormButton variant="secondary" size="md" onClick={handleExportErrorRecords}>
                导出记录
              </FormButton>
              <FormButton variant="danger" size="md" onClick={handleClearErrorRecords}>
                清空记录
              </FormButton>
            </FormButtonGroup>

            {notice ? (
              <p className={styles.infoText} style={{ opacity: 0.9, marginTop: 8 }}>
                {notice}
              </p>
            ) : null}

            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredRecords.length === 0 ? (
                <p className={styles.infoText} style={{ opacity: 0.7 }}>
                  暂无记录
                </p>
              ) : (
                filteredRecords.map((r) => (
                  <details
                    key={r.id}
                    style={{
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      padding: "6px 8px",
                    }}
                  >
                    <summary style={{ cursor: "pointer", color: "var(--text-color)" }}>
                      {new Date(r.ts).toLocaleString()} [{r.level}] {r.title} ({r.source}) x
                      {r.count}
                    </summary>
                    <div style={{ marginTop: 8 }}>
                      <p className={styles.infoText} style={{ opacity: 0.9 }}>
                        {r.message || "--"}
                      </p>
                      {r.stack ? (
                        <pre
                          style={{
                            marginTop: 8,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            fontSize: "0.75rem",
                            opacity: 0.85,
                          }}
                        >
                          {r.stack}
                        </pre>
                      ) : null}
                    </div>
                  </details>
                ))
              )}
            </div>

            <div className={styles.weatherInfo} style={{ marginTop: 10 }}>
              <p className={styles.infoText}>环境：{envInfo.isElectron ? "Electron" : "Web"}</p>
              <p className={styles.infoText} style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                UA：{envInfo.ua || "--"}
              </p>
              {(() => {
                const cache = getWeatherCache();
                const diag = cache.geolocation?.diagnostics;
                if (!diag) return null;
                return (
                  <p className={styles.infoText} style={{ fontSize: "0.8rem", opacity: 0.85 }}>
                    定位诊断：权限={diag.permissionState}{" "}
                    {diag.errorMessage ? `(${diag.errorMessage})` : ""}
                  </p>
                );
              })()}
            </div>
          </>
        ) : null}
      </FormSection>
    </div>
  );
};

export default AboutSettingsPanel;
