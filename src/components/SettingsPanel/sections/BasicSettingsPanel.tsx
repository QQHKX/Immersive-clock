import React, { useEffect, useMemo, useState } from "react";

import { useAppState, useAppDispatch } from "../../../contexts/AppContext";
import { AppMode, CountdownItem } from "../../../types";
import {
  getAppSettings,
  updateGeneralSettings,
  updateStudySettings,
  updateTimeSyncSettings,
} from "../../../utils/appSettings";
import { resolveStartupMode } from "../../../utils/startupMode";
import { readStudyBackground, saveStudyBackground } from "../../../utils/studyBackgroundStorage";
import {
  importFontFile,
  loadImportedFonts,
  ImportedFontMeta,
} from "../../../utils/studyFontStorage";
import { Dropdown } from "../../Dropdown/Dropdown";
import {
  FormSection,
  FormInput,
  FormFilePicker,
  FormSegmented,
  FormButton,
  FormButtonGroup,
  FormCheckbox,
  FormRow,
  FormSlider,
} from "../../FormComponents";
import ScheduleSettings from "../../ScheduleSettings";
import styles from "../SettingsPanel.module.css";

import { CountdownManagerPanel } from "./CountdownManagerPanel";

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
 * - 自习组件显示开关（时间始终显示）
 * - 背景设置
 * - 课表设置入口
 */
export const BasicSettingsPanel: React.FC<BasicSettingsPanelProps> = ({
  targetYear,
  onTargetYearChange,
  onRegisterSave,
}) => {
  const { study } = useAppState();
  const dispatch = useAppDispatch();

  const [startupMode, setStartupMode] = useState<AppMode>("clock");

  // 倒计时模式（重构）：'gaokao' | 'single' | 'multi'
  const [countdownMode, setCountdownMode] = useState<"gaokao" | "single" | "multi">("gaokao");

  // 倒计时设置草稿（保留兼容字段）
  const [draftCustomName, setDraftCustomName] = useState<string>(study.customName ?? "");
  const [draftCustomDate, setDraftCustomDate] = useState<string>(study.customDate ?? "");
  const [singleBgColor, setSingleBgColor] = useState<string>("");
  const [singleTextColor, setSingleTextColor] = useState<string>("");
  // 新增：轮播间隔（秒）与倒计时数字颜色（全局覆盖）
  const [carouselIntervalSec, setCarouselIntervalSec] = useState<number>(
    study.carouselIntervalSec ?? 6
  );
  const [digitColor, setDigitColor] = useState<string>(study.digitColor ?? "");
  const [timeColorMode, setTimeColorMode] = useState<"default" | "custom">(
    study.timeColor ? "custom" : "default"
  );
  const [timeColor, setTimeColor] = useState<string>(study.timeColor ?? "#ffffff");
  const [dateColorMode, setDateColorMode] = useState<"default" | "custom">(
    study.dateColor ? "custom" : "default"
  );
  const [dateColor, setDateColor] = useState<string>(study.dateColor ?? "#bbbbbb");

  // 自习组件显示草稿（时间始终显示，不提供开关）
  const defaultDisplay = useMemo(
    () => ({
      showStatusBar: true,
      showNoiseMonitor: true,
      showCountdown: true,
      showQuote: true,
      showTime: true,
      showDate: true,
    }),
    []
  );
  const [draftDisplay, setDraftDisplay] = useState<typeof defaultDisplay>({
    ...(study.display || defaultDisplay),
  });

  // 背景设置草稿
  const [bgType, setBgType] = useState<"default" | "color" | "image">("default");
  const [bgColor, setBgColor] = useState<string>("#121212");
  const [bgAlpha, setBgAlpha] = useState<number>(1);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgImageFileName, setBgImageFileName] = useState<string>("");

  // 课表设置弹窗
  const [scheduleOpen, setScheduleOpen] = useState<boolean>(false);

  // 子分区保存注册
  const countdownSaveRef = React.useRef<() => void>(() => {});

  // 单事件颜色透明度草稿
  const [singleBgOpacity, setSingleBgOpacity] = useState<number>(0);
  const [singleTextOpacity, setSingleTextOpacity] = useState<number>(1);
  // 全局数字透明度草稿
  const [digitOpacity, setDigitOpacity] = useState<number>(1);
  const [countdownStyleMode, setCountdownStyleMode] = useState<"default" | "custom">("default");
  // 字体设置草稿（来源分段：默认 / 自定义字体）
  const [numericFontMode, setNumericFontMode] = useState<"default" | "custom">("default");
  const [textFontMode, setTextFontMode] = useState<"default" | "custom">("default");
  const [importedFonts, setImportedFonts] = useState<ImportedFontMeta[]>([]);
  const [numericFontSelected, setNumericFontSelected] = useState<string>("");
  const [textFontSelected, setTextFontSelected] = useState<string>("");
  const [fontFile, setFontFile] = useState<File | null>(null);
  const [fontAlias, setFontAlias] = useState<string>("");
  const [systemFonts, setSystemFonts] = useState<{ label: string; value: string }[]>([]);
  const [systemFontSupported, setSystemFontSupported] = useState<boolean>(false);
  const [loadingSystemFonts, setLoadingSystemFonts] = useState<boolean>(false);

  const isDesktop = useMemo(() => {
    if (typeof window === "undefined") return false;
    const anyWindow = window as unknown as { electronAPI?: { platform?: string } };
    const hasBridge = typeof anyWindow.electronAPI?.platform === "string";
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isElectronUa = /\bElectron\b/i.test(ua);
    return hasBridge || isElectronUa;
  }, []);

  const ntpAvailable = useMemo(() => {
    if (typeof window === "undefined") return false;
    const anyWindow = window as unknown as { electronAPI?: { timeSync?: { ntp?: unknown } } };
    return typeof anyWindow.electronAPI?.timeSync?.ntp === "function";
  }, []);

  const [timeSyncEnabled, setTimeSyncEnabled] = useState<boolean>(false);
  const [timeSyncProvider, setTimeSyncProvider] = useState<"httpDate" | "timeApi" | "ntp">(
    "httpDate"
  );
  const [timeSyncHttpDateUrl, setTimeSyncHttpDateUrl] = useState<string>("/");
  const [timeSyncApiUrl, setTimeSyncApiUrl] = useState<string>("");
  const [timeSyncNtpHost, setTimeSyncNtpHost] = useState<string>("pool.ntp.org");
  const [timeSyncNtpPort, setTimeSyncNtpPort] = useState<number>(123);
  const [timeSyncManualOffsetSec, setTimeSyncManualOffsetSec] = useState<number>(0);
  const [timeSyncAutoEnabled, setTimeSyncAutoEnabled] = useState<boolean>(false);
  const [timeSyncAutoIntervalMin, setTimeSyncAutoIntervalMin] = useState<number>(60);
  const [timeSyncStatus, setTimeSyncStatus] = useState(getAppSettings().general.timeSync);

  // 打开时优先从 AppSettings 读取上次选择的倒计时模式
  useEffect(() => {
    try {
      setStartupMode(resolveStartupMode(getAppSettings().general.startup.initialMode));
      const saved = getAppSettings().study.countdownMode;
      if (saved === "gaokao" || saved === "single" || saved === "multi") {
        setCountdownMode(saved);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const saved = getAppSettings().general.timeSync;
      const provider =
        saved.provider === "timeApi" || saved.provider === "httpDate" || saved.provider === "ntp"
          ? saved.provider
          : "httpDate";
      const providerAllowed = provider !== "ntp" || ntpAvailable;

      setTimeSyncEnabled(!!saved.enabled && providerAllowed);
      setTimeSyncProvider(providerAllowed ? provider : "httpDate");
      setTimeSyncHttpDateUrl(typeof saved.httpDateUrl === "string" ? saved.httpDateUrl : "/");
      setTimeSyncApiUrl(typeof saved.timeApiUrl === "string" ? saved.timeApiUrl : "");
      setTimeSyncNtpHost(typeof saved.ntpHost === "string" ? saved.ntpHost : "pool.ntp.org");
      setTimeSyncNtpPort(Number.isFinite(saved.ntpPort) ? Math.trunc(saved.ntpPort) : 123);
      setTimeSyncManualOffsetSec(
        Number.isFinite(saved.manualOffsetMs) ? Math.trunc(saved.manualOffsetMs) / 1000 : 0
      );
      setTimeSyncAutoEnabled(!!saved.autoSyncEnabled);
      setTimeSyncAutoIntervalMin(
        Number.isFinite(saved.autoSyncIntervalSec)
          ? Math.max(1, Math.round(saved.autoSyncIntervalSec / 60))
          : 60
      );
      setTimeSyncStatus(saved);
    } catch {}
  }, [ntpAvailable]);

  useEffect(() => {
    const refresh = () => {
      try {
        setTimeSyncStatus(getAppSettings().general.timeSync);
      } catch {}
    };
    refresh();
    window.addEventListener("timeSync:updated", refresh as EventListener);
    window.addEventListener("settingsSaved", refresh as EventListener);
    return () => {
      window.removeEventListener("timeSync:updated", refresh as EventListener);
      window.removeEventListener("settingsSaved", refresh as EventListener);
    };
  }, []);

  // 独立加载字体列表
  useEffect(() => {
    loadImportedFonts().then(setImportedFonts);
  }, []);

  /**
   * 探测当前环境是否支持本地字体读取（函数级注释：检查浏览器是否提供 queryLocalFonts 接口，用于后续系统字体列表的读取）
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const anyWindow = window as unknown as { queryLocalFonts?: () => Promise<unknown[]> };
    setSystemFontSupported(typeof anyWindow.queryLocalFonts === "function");
  }, []);

  useEffect(() => {
    // 同步草稿为当前应用状态（打开面板或刷新时）

    setDraftCustomName(study.customName ?? "");
    setDraftCustomDate(study.customDate ?? "");
    setDraftDisplay({ ...(study.display || defaultDisplay), showTime: true });
    // 背景设置
    const bg = readStudyBackground();
    setBgType(bg.type);
    if (bg.color) setBgColor(bg.color);
    setBgAlpha(typeof bg.colorAlpha === "number" ? bg.colorAlpha : 1);
    setBgImage(bg.imageDataUrl ?? null);
    setBgImageFileName("");

    const nextDigitColor = study.digitColor ?? "";
    setDigitColor(nextDigitColor);

    // 根据现有 countdownItems 推断模式，并填充单项颜色
    const items = study.countdownItems || [];
    let nextSingleBgColor = "";
    let nextSingleTextColor = "";
    let nextSingleBgOpacity = 0;
    let nextSingleTextOpacity = 1;
    if (Array.isArray(items) && items.length > 1) {
      setCountdownMode("multi");
      setSingleBgColor(nextSingleBgColor);
      setSingleTextColor(nextSingleTextColor);
      setSingleBgOpacity(nextSingleBgOpacity);
      setSingleTextOpacity(nextSingleTextOpacity);
    } else if (Array.isArray(items) && items.length === 1) {
      const it = items[0];
      if (it.kind === "gaokao") {
        setCountdownMode("gaokao");
        nextSingleBgColor = it.bgColor || "";
        nextSingleTextColor = it.textColor || "";
        nextSingleBgOpacity = typeof it.bgOpacity === "number" ? it.bgOpacity : 0;
        nextSingleTextOpacity = typeof it.textOpacity === "number" ? it.textOpacity : 1;
        setSingleBgColor(nextSingleBgColor);
        setSingleTextColor(nextSingleTextColor);
        setSingleBgOpacity(nextSingleBgOpacity);
        setSingleTextOpacity(nextSingleTextOpacity);
        // 名称可编辑但不需要日期
        setDraftCustomName(it.name || "");
        setDraftCustomDate("");
      } else {
        setCountdownMode("single");
        setDraftCustomName(it.name || study.customName || "");
        setDraftCustomDate(it.targetDate || study.customDate || "");
        nextSingleBgColor = it.bgColor || "";
        nextSingleTextColor = it.textColor || "";
        nextSingleBgOpacity = typeof it.bgOpacity === "number" ? it.bgOpacity : 0;
        nextSingleTextOpacity = typeof it.textOpacity === "number" ? it.textOpacity : 1;
        setSingleBgColor(nextSingleBgColor);
        setSingleTextColor(nextSingleTextColor);
        setSingleBgOpacity(nextSingleBgOpacity);
        setSingleTextOpacity(nextSingleTextOpacity);
      }
    } else {
      // 兼容旧逻辑：无 items 时用 countdownType 决定模式
      setCountdownMode((study.countdownType ?? "gaokao") === "gaokao" ? "gaokao" : "single");
      setSingleBgColor(nextSingleBgColor);
      setSingleTextColor(nextSingleTextColor);
      setSingleBgOpacity(nextSingleBgOpacity);
      setSingleTextOpacity(nextSingleTextOpacity);
    }
    const nextDigitOpacity = typeof study.digitOpacity === "number" ? study.digitOpacity : 1;
    setDigitOpacity(nextDigitOpacity);
    const hasCountdownCustomStyle =
      nextDigitColor.trim().length > 0 ||
      nextDigitOpacity !== 1 ||
      nextSingleBgColor.trim().length > 0 ||
      nextSingleTextColor.trim().length > 0 ||
      nextSingleBgOpacity !== 0 ||
      nextSingleTextOpacity !== 1;
    setCountdownStyleMode(hasCountdownCustomStyle ? "custom" : "default");
    setTimeColorMode(study.timeColor ? "custom" : "default");
    setTimeColor(study.timeColor ?? "#ffffff");
    setDateColorMode(study.dateColor ? "custom" : "default");
    setDateColor(study.dateColor ?? "#bbbbbb");
    // 初始化字体来源分段（函数级注释：根据当前状态决定使用默认或自定义字体，并填充自定义内容）
    const initMode = (
      current: string | undefined
    ): { mode: "default" | "custom"; custom: string } => {
      if (!current || current.trim().length === 0) return { mode: "default", custom: "" };
      return { mode: "custom", custom: current };
    };
    const nf = initMode(study.numericFontFamily);
    const tf = initMode(study.textFontFamily);
    setNumericFontMode(nf.mode);
    setTextFontMode(tf.mode);

    // 异步加载字体列表
    loadImportedFonts().then(setImportedFonts);

    setNumericFontSelected(nf.custom);
    setTextFontSelected(tf.custom);
  }, [
    study.countdownType,
    study.customName,
    study.customDate,
    study.display,
    defaultDisplay,
    study.countdownItems,
    study.digitColor,
    study.digitOpacity,
    study.timeColor,
    study.dateColor,
    study.numericFontFamily,
    study.textFontFamily,
  ]);

  // 注册保存动作：统一在父组件保存时派发
  useEffect(() => {
    onRegisterSave?.(() => {
      // 倒计时模式映射到旧字段：多事件作为自定义类型
      const nextType: "gaokao" | "custom" = countdownMode === "gaokao" ? "gaokao" : "custom";
      dispatch({ type: "SET_COUNTDOWN_TYPE", payload: nextType });

      // 单事件时更新旧字段（用于兼容回退显示）
      if (countdownMode === "single") {
        dispatch({
          type: "SET_CUSTOM_COUNTDOWN",
          payload: { name: draftCustomName, date: draftCustomDate },
        });
      }

      // 保存组件显示设置（强制时间显示）
      dispatch({ type: "SET_STUDY_DISPLAY", payload: { ...draftDisplay, showTime: true } });
      // 保存轮播间隔与数字颜色（多事件不再统一修改数字颜色）
      if (countdownMode === "multi") {
        dispatch({ type: "SET_CAROUSEL_INTERVAL", payload: carouselIntervalSec });
      } else {
        dispatch({
          type: "SET_COUNTDOWN_DIGIT_COLOR",
          payload: countdownStyleMode === "custom" ? digitColor || undefined : undefined,
        });
        dispatch({
          type: "SET_COUNTDOWN_DIGIT_OPACITY",
          payload: countdownStyleMode === "custom" ? digitOpacity : 1,
        });
      }
      dispatch({
        type: "SET_STUDY_TIME_COLOR",
        payload: timeColorMode === "custom" ? timeColor : undefined,
      });
      dispatch({
        type: "SET_STUDY_DATE_COLOR",
        payload: dateColorMode === "custom" ? dateColor : undefined,
      });
      // 保存背景设置
      saveStudyBackground({
        type: bgType,
        color: bgType === "color" ? bgColor : undefined,
        colorAlpha: bgType === "color" ? bgAlpha : undefined,
        imageDataUrl: bgType === "image" ? (bgImage ?? undefined) : undefined,
      });
      // 通知学习页面刷新背景
      window.dispatchEvent(new CustomEvent("study-background-updated"));

      // 保存倒计时项目
      if (countdownMode === "gaokao") {
        const one: CountdownItem[] = [
          {
            id: "gaokao-default",
            kind: "gaokao",
            name: "高考倒计时",
            bgColor: countdownStyleMode === "custom" ? singleBgColor || undefined : undefined,
            bgOpacity: countdownStyleMode === "custom" ? singleBgOpacity : 0,
            textColor: countdownStyleMode === "custom" ? singleTextColor || undefined : undefined,
            textOpacity: countdownStyleMode === "custom" ? singleTextOpacity : 1,
            order: 0,
          },
        ];
        dispatch({ type: "SET_COUNTDOWN_ITEMS", payload: one });
      } else if (countdownMode === "single") {
        const one: CountdownItem[] = [
          {
            id: "custom-default",
            kind: "custom",
            name: (draftCustomName && draftCustomName.trim()) || "自定义事件",
            targetDate: (draftCustomDate && draftCustomDate.trim()) || "",
            bgColor: countdownStyleMode === "custom" ? singleBgColor || undefined : undefined,
            bgOpacity: countdownStyleMode === "custom" ? singleBgOpacity : 0,
            textColor: countdownStyleMode === "custom" ? singleTextColor || undefined : undefined,
            textOpacity: countdownStyleMode === "custom" ? singleTextOpacity : 1,
            order: 0,
          },
        ];
        dispatch({ type: "SET_COUNTDOWN_ITEMS", payload: one });
      } else {
        // 多事件：由子面板负责收集并保存
        countdownSaveRef.current?.();
      }
      // 记录最近启用的模式，确保下次打开直接显示
      try {
        updateStudySettings({ countdownMode });
      } catch {}

      // 保存字体设置（函数级注释：根据选择与自定义输入计算最终的 font-family 并派发到全局状态）
      const resolveFont = (mode: "default" | "custom", selected: string): string | undefined => {
        if (mode === "default") return undefined;
        const v = selected.trim();
        return v.length > 0 ? v : undefined;
      };
      const nextNumeric = resolveFont(numericFontMode, numericFontSelected);
      const nextText = resolveFont(textFontMode, textFontSelected);
      dispatch({ type: "SET_STUDY_NUMERIC_FONT", payload: nextNumeric });
      dispatch({ type: "SET_STUDY_TEXT_FONT", payload: nextText });

      updateGeneralSettings({ startup: { initialMode: startupMode } });

      updateTimeSyncSettings((current) => ({
        enabled: timeSyncEnabled,
        provider: timeSyncProvider,
        httpDateUrl: timeSyncHttpDateUrl.trim() || current.httpDateUrl,
        timeApiUrl: timeSyncApiUrl.trim(),
        ntpHost: timeSyncNtpHost.trim() || current.ntpHost,
        ntpPort: Math.max(1, Math.min(65535, Math.trunc(timeSyncNtpPort || 123))),
        manualOffsetMs: Math.round(
          (Number.isFinite(timeSyncManualOffsetSec) ? timeSyncManualOffsetSec : 0) * 1000
        ),
        autoSyncEnabled: timeSyncAutoEnabled,
        autoSyncIntervalSec: Math.max(
          60,
          Math.round((Number.isFinite(timeSyncAutoIntervalMin) ? timeSyncAutoIntervalMin : 60) * 60)
        ),
      }));
    });
  }, [
    onRegisterSave,
    countdownMode,
    draftCustomName,
    draftCustomDate,
    draftDisplay,
    carouselIntervalSec,
    digitColor,
    digitOpacity,
    countdownStyleMode,
    timeColorMode,
    timeColor,
    dateColorMode,
    dateColor,
    bgType,
    bgColor,
    bgAlpha,
    bgImage,
    singleBgColor,
    singleTextColor,
    singleBgOpacity,
    singleTextOpacity,
    dispatch,
    numericFontMode,
    numericFontSelected,
    textFontMode,
    textFontSelected,
    startupMode,
    timeSyncEnabled,
    timeSyncProvider,
    timeSyncHttpDateUrl,
    timeSyncApiUrl,
    timeSyncNtpHost,
    timeSyncNtpPort,
    timeSyncManualOffsetSec,
    timeSyncAutoEnabled,
    timeSyncAutoIntervalMin,
  ]);

  /** 构建字体选择列表（函数级注释：合并已导入字体与内置字体，供下拉选择使用） */
  const builtInNumericFonts = useMemo(
    () => [
      { label: "Roboto Mono", value: "'Roboto Mono', monospace" },
      { label: "JetBrains Mono", value: "'JetBrains Mono', monospace" },
      { label: "Source Code Pro", value: "'Source Code Pro', monospace" },
      { label: "SFMono-Regular", value: "'SFMono-Regular', monospace" },
      { label: "Consolas", value: "Consolas, monospace" },
      { label: "Menlo", value: "Menlo, monospace" },
      { label: "Cascadia Mono", value: "'Cascadia Mono', monospace" },
    ],
    []
  );
  const builtInTextFonts = useMemo(
    () => [
      { label: "Inter", value: "'Inter', sans-serif" },
      { label: "Segoe UI", value: "'Segoe UI', sans-serif" },
      { label: "Microsoft YaHei", value: "'Microsoft YaHei', sans-serif" },
      { label: "PingFang SC", value: "'PingFang SC', sans-serif" },
      { label: "Noto Sans SC", value: "'Noto Sans SC', sans-serif" },
      { label: "Noto Serif SC", value: "'Noto Serif SC', serif" },
      { label: "Helvetica Neue", value: "'Helvetica Neue', sans-serif" },
      { label: "Arial", value: "Arial, sans-serif" },
      { label: "system-ui", value: "system-ui, sans-serif" },
    ],
    []
  );

  /** 导入字体文件（函数级注释：读取所选字体文件为DataURL并保存为指定家族名） */
  const handleImportFont = async () => {
    if (!fontFile) {
      alert("请选择要导入的字体文件（TTF/OTF/WOFF/WOFF2）");
      return;
    }
    const family =
      (fontAlias && fontAlias.trim()) || fontFile.name.replace(/\.(ttf|otf|woff2?|)$/i, "");
    try {
      await importFontFile(fontFile, family);
      const fonts = await loadImportedFonts();
      setImportedFonts(fonts);
      alert(`已导入字体：${family}`);
      setFontFile(null);
      setFontAlias("");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : typeof error === "string" ? error : "未知错误";
      alert(`导入字体失败：${message}`);
    }
  };

  /**
   * 读取系统已安装字体列表（函数级注释：通过浏览器的 queryLocalFonts 接口请求本机字体家族名，并转换为下拉选项供选择）
   */
  const handleLoadSystemFonts = async () => {
    if (typeof window === "undefined") {
      alert("当前环境不支持读取系统字体");
      return;
    }
    const anyWindow = window as unknown as {
      queryLocalFonts?: () => Promise<
        {
          family?: string;
        }[]
      >;
    };
    if (typeof anyWindow.queryLocalFonts !== "function") {
      alert("当前浏览器不支持直接读取系统字体，请使用导入字体或手动输入字体名称。");
      return;
    }
    try {
      setLoadingSystemFonts(true);
      const fonts = await anyWindow.queryLocalFonts();
      const seen = new Set<string>();
      const options: { label: string; value: string }[] = [];
      for (const f of fonts) {
        const rawFamily = typeof f?.family === "string" ? f.family.trim() : "";
        if (!rawFamily || seen.has(rawFamily)) continue;
        seen.add(rawFamily);
        const safeFamily = rawFamily.replace(/"/g, '\\"');
        options.push({
          label: rawFamily,
          value: `"${safeFamily}"`,
        });
      }
      options.sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN"));
      setSystemFonts(options);
      if (options.length === 0) {
        alert("未能从系统中读取到可用字体，请检查浏览器权限设置。");
      } else {
        alert(`已读取到 ${options.length} 个系统字体，可在下拉列表中选择。`);
      }
    } catch (error: unknown) {
      console.error("Failed to load system fonts:", error);
      const message =
        error instanceof Error ? error.message : typeof error === "string" ? error : "未知错误";
      alert(`读取系统字体失败：${message}`);
    } finally {
      setLoadingSystemFonts(false);
    }
  };

  return (
    <div id="basic-panel" role="tabpanel" aria-labelledby="basic">
      {/* 显示设置分区已前移到倒计时设置之前 */}

      <FormSection title="启动设置">
        <FormRow gap="sm" align="center">
          <FormSegmented
            label="启动时默认页面"
            value={startupMode}
            options={[
              { label: "时钟", value: "clock" },
              { label: "倒计时", value: "countdown" },
              { label: "秒表", value: "stopwatch" },
              { label: "自习", value: "study" },
            ]}
            onChange={(v) => setStartupMode(v as AppMode)}
          />
        </FormRow>
        <p className={styles.helpText}>该设置将在下次启动（或刷新页面）后生效。</p>
      </FormSection>

      {/* 倒计时设置 */}
      <FormSection title="倒计时设置">
        <FormSegmented
          label="模式"
          value={countdownMode}
          options={[
            { label: "高考", value: "gaokao" },
            { label: "单事件", value: "single" },
            { label: "多事件", value: "multi" },
          ]}
          onChange={(v) => setCountdownMode(v as "gaokao" | "single" | "multi")}
        />

        {countdownMode === "multi" && (
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

        {countdownMode === "gaokao" && (
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
            </FormRow>
            <FormRow gap="sm" align="center">
              <FormSegmented
                label="样式"
                value={countdownStyleMode}
                options={[
                  { label: "默认", value: "default" },
                  { label: "自定义", value: "custom" },
                ]}
                onChange={(v) => setCountdownStyleMode(v as "default" | "custom")}
              />
            </FormRow>
            {countdownStyleMode === "custom" && (
              <FormRow gap="sm" align="center">
                <FormInput
                  label="背景色"
                  type="color"
                  value={singleBgColor || "#121212"}
                  onChange={(e) => setSingleBgColor(e.target.value)}
                  style={{ width: 36, height: 36, padding: 0 }}
                />
                <FormSlider
                  label="背景透明度"
                  min={0}
                  max={1}
                  step={0.01}
                  value={singleBgOpacity}
                  onChange={(v) => setSingleBgOpacity(v)}
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                />
                <FormInput
                  label="文字色"
                  type="color"
                  value={singleTextColor || "#E0E0E0"}
                  onChange={(e) => setSingleTextColor(e.target.value)}
                  style={{ width: 36, height: 36, padding: 0 }}
                />
                <FormSlider
                  label="文字透明度"
                  min={0}
                  max={1}
                  step={0.01}
                  value={singleTextOpacity}
                  onChange={(v) => setSingleTextOpacity(v)}
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                />
                <FormInput
                  label="数字颜色"
                  type="color"
                  value={digitColor || "#03DAC6"}
                  onChange={(e) => setDigitColor(e.target.value)}
                  style={{ width: 36, height: 36, padding: 0 }}
                />
                <FormSlider
                  label="数字透明度"
                  min={0}
                  max={1}
                  step={0.01}
                  value={digitOpacity}
                  onChange={(v) => setDigitOpacity(v)}
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                />
              </FormRow>
            )}
          </>
        )}

        {countdownMode === "single" && (
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
              <FormSegmented
                label="样式"
                value={countdownStyleMode}
                options={[
                  { label: "默认", value: "default" },
                  { label: "自定义", value: "custom" },
                ]}
                onChange={(v) => setCountdownStyleMode(v as "default" | "custom")}
              />
            </FormRow>
            {countdownStyleMode === "custom" && (
              <FormRow gap="sm" align="center">
                <FormInput
                  label="背景色"
                  type="color"
                  value={singleBgColor || "#121212"}
                  onChange={(e) => setSingleBgColor(e.target.value)}
                  style={{ width: 36, height: 36, padding: 0 }}
                />
                <FormSlider
                  label="背景透明度"
                  min={0}
                  max={1}
                  step={0.01}
                  value={singleBgOpacity}
                  onChange={(v) => setSingleBgOpacity(v)}
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                />
                <FormInput
                  label="文字色"
                  type="color"
                  value={singleTextColor || "#E0E0E0"}
                  onChange={(e) => setSingleTextColor(e.target.value)}
                  style={{ width: 36, height: 36, padding: 0 }}
                />
                <FormSlider
                  label="文字透明度"
                  min={0}
                  max={1}
                  step={0.01}
                  value={singleTextOpacity}
                  onChange={(v) => setSingleTextOpacity(v)}
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                />
                <FormInput
                  label="数字颜色"
                  type="color"
                  value={digitColor || "#03DAC6"}
                  onChange={(e) => setDigitColor(e.target.value)}
                  style={{ width: 36, height: 36, padding: 0 }}
                />
                <FormSlider
                  label="数字透明度"
                  min={0}
                  max={1}
                  step={0.01}
                  value={digitOpacity}
                  onChange={(v) => setDigitOpacity(v)}
                  formatValue={(v) => `${Math.round(v * 100)}%`}
                />
              </FormRow>
            )}
          </>
        )}

        {countdownMode === "multi" && (
          <CountdownManagerPanel
            onRegisterSave={(fn) => {
              countdownSaveRef.current = fn;
            }}
          />
        )}
      </FormSection>

      <FormSection title="显示设置">
        <p className={styles.helpText}>选择自习页面显示的组件（时间始终显示）。</p>
        <FormRow gap="sm" align="center">
          <FormCheckbox
            label="状态栏"
            checked={!!draftDisplay.showStatusBar}
            onChange={(e) =>
              setDraftDisplay((prev) => ({ ...prev, showStatusBar: e.target.checked }))
            }
          />
          <FormCheckbox
            label="噪音监测"
            id="tour-noise-monitor-checkbox"
            checked={!!draftDisplay.showNoiseMonitor}
            onChange={(e) =>
              setDraftDisplay((prev) => ({ ...prev, showNoiseMonitor: e.target.checked }))
            }
          />
          <FormCheckbox
            label="倒计时"
            checked={!!draftDisplay.showCountdown}
            onChange={(e) =>
              setDraftDisplay((prev) => ({ ...prev, showCountdown: e.target.checked }))
            }
          />
          <FormCheckbox
            label="励志语录"
            checked={!!draftDisplay.showQuote}
            onChange={(e) => setDraftDisplay((prev) => ({ ...prev, showQuote: e.target.checked }))}
          />
          <FormCheckbox
            label="日期"
            checked={!!draftDisplay.showDate}
            onChange={(e) => setDraftDisplay((prev) => ({ ...prev, showDate: e.target.checked }))}
          />
        </FormRow>
      </FormSection>

      <FormSection title="时间与日期颜色">
        <p className={styles.helpText}>为自习页面中央时间与日期单独设置颜色（默认跟随主题）。</p>
        <FormRow gap="sm" align="center">
          <FormSegmented
            label="时间颜色"
            value={timeColorMode}
            options={[
              { label: "默认", value: "default" },
              { label: "自定义", value: "custom" },
            ]}
            onChange={(v) => setTimeColorMode(v as "default" | "custom")}
          />
          {timeColorMode === "custom" && (
            <FormInput
              label="选择颜色"
              type="color"
              value={timeColor || "#ffffff"}
              onChange={(e) => setTimeColor(e.target.value)}
              style={{ width: 36, height: 36, padding: 0 }}
            />
          )}
        </FormRow>
        <FormRow gap="sm" align="center">
          <FormSegmented
            label="日期颜色"
            value={dateColorMode}
            options={[
              { label: "默认", value: "default" },
              { label: "自定义", value: "custom" },
            ]}
            onChange={(v) => setDateColorMode(v as "default" | "custom")}
          />
          {dateColorMode === "custom" && (
            <FormInput
              label="选择颜色"
              type="color"
              value={dateColor || "#bbbbbb"}
              onChange={(e) => setDateColor(e.target.value)}
              style={{ width: 36, height: 36, padding: 0 }}
            />
          )}
        </FormRow>
      </FormSection>

      <FormSection title="字体设置">
        <p className={styles.helpText}>选择数字或文本的自定义字体。</p>
        <FormRow gap="sm" align="center">
          <FormSegmented
            label="数字字体来源"
            value={numericFontMode}
            options={[
              { label: "默认", value: "default" },
              { label: "自定义字体", value: "custom" },
            ]}
            onChange={(v) => setNumericFontMode(v as "default" | "custom")}
          />
          {numericFontMode === "custom" && (
            <FormRow gap="sm" align="center">
              <FormInput
                label="选择已导入或内置字体"
                placeholder="选择后保存即应用"
                value={numericFontSelected}
                onChange={() => {}}
                style={{ display: "none" }}
              />
              <Dropdown
                placeholder="请选择数字字体"
                value={numericFontSelected}
                onChange={(v) => setNumericFontSelected((v as string) || "")}
                searchable
                width={280}
                groups={[
                  {
                    label: "—— 已导入 ——",
                    options:
                      importedFonts.length > 0
                        ? importedFonts.map((f) => ({ label: f.family, value: f.family }))
                        : [{ label: "暂无已导入字体", value: "__none__", disabled: true }],
                  },
                  {
                    label: "—— 系统字体（实验性） ——",
                    options:
                      systemFonts.length > 0
                        ? systemFonts
                        : [
                            systemFontSupported
                              ? {
                                  label: loadingSystemFonts
                                    ? "正在读取系统字体..."
                                    : "点击“读取系统字体”按钮后刷新此列表",
                                  value: "__sys_hint__",
                                  disabled: true,
                                }
                              : {
                                  label: "当前浏览器不支持系统字体读取",
                                  value: "__sys_hint__",
                                  disabled: true,
                                },
                          ],
                  },
                  {
                    label: "—— 内置 ——",
                    options: builtInNumericFonts,
                  },
                ]}
              />
            </FormRow>
          )}
        </FormRow>
        <FormRow gap="sm" align="center">
          <FormSegmented
            label="文本字体来源"
            value={textFontMode}
            options={[
              { label: "默认", value: "default" },
              { label: "自定义字体", value: "custom" },
            ]}
            onChange={(v) => setTextFontMode(v as "default" | "custom")}
          />
          {textFontMode === "custom" && (
            <FormRow gap="sm" align="center">
              <FormInput
                label="选择已导入或内置字体"
                placeholder="选择后保存即应用"
                value={textFontSelected}
                onChange={() => {}}
                style={{ display: "none" }}
              />
              <Dropdown
                placeholder="请选择文本字体"
                value={textFontSelected}
                onChange={(v) => setTextFontSelected((v as string) || "")}
                searchable
                width={280}
                groups={[
                  {
                    label: "—— 已导入 ——",
                    options:
                      importedFonts.length > 0
                        ? importedFonts.map((f) => ({ label: f.family, value: f.family }))
                        : [{ label: "暂无已导入字体", value: "__none__", disabled: true }],
                  },
                  {
                    label: "—— 系统字体（实验性） ——",
                    options:
                      systemFonts.length > 0
                        ? systemFonts
                        : [
                            systemFontSupported
                              ? {
                                  label: loadingSystemFonts
                                    ? "正在读取系统字体..."
                                    : "点击“读取系统字体”按钮后刷新此列表",
                                  value: "__sys_hint__",
                                  disabled: true,
                                }
                              : {
                                  label: "当前浏览器不支持系统字体读取",
                                  value: "__sys_hint__",
                                  disabled: true,
                                },
                          ],
                  },
                  {
                    label: "—— 内置 ——",
                    options: builtInTextFonts,
                  },
                ]}
              />
            </FormRow>
          )}
        </FormRow>
        {(numericFontMode === "custom" || textFontMode === "custom") && (
          <>
            <FormRow gap="sm" align="center">
              <FormInput
                label="字体别名"
                type="text"
                value={fontAlias}
                onChange={(e) => setFontAlias(e.target.value)}
                placeholder='例如："JetBrains Mono"'
              />
              <FormFilePicker
                label="字体文件"
                accept=".ttf,.otf,.woff,.woff2"
                fileName={fontFile?.name}
                placeholder="未选择字体文件"
                buttonText="选择字体文件"
                onFileChange={(file) => setFontFile(file)}
              />
              <FormButton variant="secondary" onClick={handleImportFont}>
                导入字体文件
              </FormButton>
              <FormButton
                variant="secondary"
                onClick={handleLoadSystemFonts}
                disabled={!systemFontSupported || loadingSystemFonts}
              >
                {loadingSystemFonts ? "正在读取系统字体..." : "读取系统字体"}
              </FormButton>
            </FormRow>
            <p className={styles.helpText}>
              系统字体读取基于浏览器 Local Font Access 接口，仅部分 Chromium
              浏览器在安全上下文中支持。
            </p>
          </>
        )}
      </FormSection>

      {/* 背景设置 */}
      <FormSection title="背景设置">
        <p className={styles.helpText}>
          选择背景来源，并支持颜色或本地图片。保存后将应用到自习页面。
        </p>
        <FormSegmented
          label="背景来源"
          value={bgType}
          options={[
            { label: "使用系统默认", value: "default" },
            { label: "自定义颜色", value: "color" },
            { label: "背景图片", value: "image" },
          ]}
          onChange={(v) => setBgType(v as "default" | "color" | "image")}
        />

        {bgType === "color" && (
          <>
            <FormRow gap="sm">
              <FormInput
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
              />
              <FormInput
                type="text"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                placeholder="#121212"
              />
              <FormSlider
                label="背景透明度"
                min={0}
                max={1}
                step={0.01}
                value={bgAlpha}
                onChange={(v) => setBgAlpha(v)}
                formatValue={(v) => `${Math.round(v * 100)}%`}
              />
            </FormRow>
            <p className={styles.helpText}>支持调色盘或十六进制颜色代码（例如 #1a1a1a）。</p>
          </>
        )}

        {bgType === "image" && (
          <>
            <FormRow gap="sm">
              <FormFilePicker
                label="背景图片"
                accept="image/*"
                fileName={bgImageFileName}
                placeholder="未选择图片"
                buttonText="选择图片"
                onFileChange={(file) => {
                  if (!file) return;
                  setBgImageFileName(file.name);
                  const reader = new FileReader();
                  reader.onload = () => setBgImage(reader.result as string);
                  reader.readAsDataURL(file);
                }}
              />
            </FormRow>
            {bgImage && (
              <>
                <img
                  src={bgImage}
                  alt="背景预览"
                  style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #333" }}
                />
                <FormRow gap="sm">
                  <FormButton variant="secondary" onClick={() => setBgImage(null)}>
                    移除图片
                  </FormButton>
                </FormRow>
              </>
            )}
          </>
        )}
      </FormSection>

      <FormSection title="时间与校时">
        <FormSegmented
          label="校时来源"
          value={timeSyncEnabled ? timeSyncProvider : "default"}
          options={[
            { label: "默认", value: "default" },
            { label: "HTTP Date", value: "httpDate" },
            { label: "时间 API", value: "timeApi" },
            ...(isDesktop
              ? [
                  {
                    label: "NTP（桌面端）",
                    value: "ntp",
                    disabled: !ntpAvailable,
                  },
                ]
              : []),
          ]}
          onChange={(v) => {
            if (v === "default") {
              setTimeSyncEnabled(false);
            } else {
              setTimeSyncEnabled(true);
              setTimeSyncProvider(v as "httpDate" | "timeApi" | "ntp");
            }
          }}
        />

        {timeSyncEnabled && (
          <>
            {timeSyncProvider === "httpDate" ? (
              <FormInput
                label="HTTP Date URL"
                value={timeSyncHttpDateUrl}
                placeholder="/"
                onChange={(e) => setTimeSyncHttpDateUrl(e.target.value)}
              />
            ) : timeSyncProvider === "timeApi" ? (
              <FormInput
                label="时间 API URL"
                value={timeSyncApiUrl}
                placeholder="https://example.com/time（返回 JSON：epochMs/epochSeconds/unixtime/datetime）"
                onChange={(e) => setTimeSyncApiUrl(e.target.value)}
              />
            ) : (
              <FormRow gap="sm" align="center">
                <FormInput
                  label="NTP Host"
                  value={timeSyncNtpHost}
                  placeholder="pool.ntp.org"
                  onChange={(e) => setTimeSyncNtpHost(e.target.value)}
                />
                <FormInput
                  label="端口"
                  type="number"
                  variant="number"
                  min={1}
                  max={65535}
                  step={1}
                  value={String(timeSyncNtpPort)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const n = raw.trim() ? Number(raw) : 123;
                    setTimeSyncNtpPort(Number.isFinite(n) ? Math.trunc(n) : 123);
                  }}
                />
              </FormRow>
            )}

            <FormRow gap="sm" align="center">
              <FormInput
                label="手动偏移（秒）"
                type="number"
                variant="number"
                step="0.1"
                value={String(timeSyncManualOffsetSec)}
                onChange={(e) => {
                  const raw = e.target.value;
                  const n = raw.trim() ? Number(raw) : 0;
                  setTimeSyncManualOffsetSec(Number.isFinite(n) ? n : 0);
                }}
              />
              <FormCheckbox
                label="自动校时"
                checked={timeSyncAutoEnabled}
                onChange={(e) => setTimeSyncAutoEnabled(e.target.checked)}
              />
              <FormInput
                label="间隔（分钟）"
                type="number"
                variant="number"
                min={1}
                step={1}
                value={String(timeSyncAutoIntervalMin)}
                onChange={(e) => {
                  const raw = e.target.value;
                  const n = raw.trim() ? Number(raw) : 60;
                  setTimeSyncAutoIntervalMin(Number.isFinite(n) ? n : 60);
                }}
              />
            </FormRow>

            <FormButtonGroup>
              <FormButton
                type="button"
                variant="secondary"
                onClick={() => window.dispatchEvent(new CustomEvent("timeSync:syncNow"))}
              >
                立即校时
              </FormButton>
            </FormButtonGroup>

            <p className={styles.infoText}>
              当前有效偏移（已保存）：
              {timeSyncStatus?.enabled
                ? `${Math.trunc((timeSyncStatus.offsetMs || 0) + (timeSyncStatus.manualOffsetMs || 0))} ms`
                : "未启用"}
            </p>
            <p className={styles.infoText}>
              上次校时（已保存）：
              {timeSyncStatus?.lastSyncAt
                ? new Date(timeSyncStatus.lastSyncAt).toLocaleString("zh-CN")
                : "无"}
              {typeof timeSyncStatus?.lastRttMs === "number"
                ? `｜RTT ${timeSyncStatus.lastRttMs} ms`
                : ""}
            </p>
            {timeSyncStatus?.lastError && timeSyncStatus.lastError.trim() && (
              <p className={styles.helpText}>错误：{timeSyncStatus.lastError}</p>
            )}
            {isDesktop && !ntpAvailable && (
              <p className={styles.helpText}>
                提示：检测到桌面端环境，但 NTP 能力未就绪（preload
                未加载到最新版本）；请重新启动桌面端或重新构建桌面端产物。
              </p>
            )}
            {timeSyncProvider === "httpDate" && (
              <p className={styles.helpText}>
                提示：跨域读取 HTTP Date 需要服务端配置 Expose-Headers: Date；建议同源或自建接口。
              </p>
            )}
            {timeSyncProvider === "ntp" && (
              <p className={styles.helpText}>
                提示：NTP 使用
                UDP/123，可能会被防火墙或网络策略拦截；若提示“桌面端不可用”，请先重建桌面端产物。
              </p>
            )}
          </>
        )}
      </FormSection>

      <FormSection title="课表设置">
        <p className={styles.helpText}>在此管理自习课程时间段，保存后即时生效。</p>
        <FormButtonGroup align="left">
          <FormButton variant="primary" onClick={() => setScheduleOpen(true)}>
            打开课表设置
          </FormButton>
        </FormButtonGroup>
        <ScheduleSettings
          isOpen={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          onSave={() => {
            /* 已在弹窗内持久化 */
          }}
        />
      </FormSection>
    </div>
  );
};

export default BasicSettingsPanel;
