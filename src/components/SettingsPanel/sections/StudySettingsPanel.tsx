import React, { useCallback, useEffect, useState } from "react";

import { DEFAULT_NOISE_REPORT_RETENTION_DAYS } from "../../../constants/noiseReport";
import { useAppState } from "../../../contexts/AppContext";
import { getAppSettings, updateNoiseSettings } from "../../../utils/appSettings";
import { pushErrorCenterRecord } from "../../../utils/errorCenter";
import { logger } from "../../../utils/logger";
import {
  getNoiseControlSettings,
  saveNoiseControlSettings,
} from "../../../utils/noiseControlSettings";
import {
  estimateMaxRetentionDaysByQuota,
  getNoiseReportSettings,
  setAutoPopupSetting,
  setRetentionDaysSetting,
} from "../../../utils/noiseReportSettings";
import {
  broadcastSettingsEvent,
  SETTINGS_EVENTS,
  subscribeSettingsEvent,
} from "../../../utils/settingsEvents";
import {
  FormSection,
  FormButton,
  FormButtonGroup,
  FormCheckbox,
  FormInput,
  FormSlider,
  FormRow,
} from "../../FormComponents";
import { VolumeIcon, VolumeMuteIcon } from "../../Icons";
import { NoiseStatsSummary } from "../../NoiseSettings/NoiseStatsSummary";
import { RealTimeNoiseChart } from "../../NoiseSettings/RealTimeNoiseChart";
import styles from "../SettingsPanel.module.css";

/**
 * 学习功能分段组件的属性
 * - `onScheduleSave`：保存课程表后的回调
 */
export interface StudySettingsPanelProps {
  onRegisterSave?: (fn: () => void) => void;
}

/**
 * 学习功能分段组件
 * - 噪音校准与报告设置
 * - 噪音图表与历史
 * - 课程表编辑
 */
/**
 * 学习功能分段组件
 * - 噪音校准与报告设置
 * - 噪音图表与历史
 * - 课程表编辑
 */
export const StudySettingsPanel: React.FC<StudySettingsPanelProps> = ({ onRegisterSave }) => {
  const { study } = useAppState();
  const [_effectiveBaselineRms, setEffectiveBaselineRms] = useState<number>(() => {
    return getAppSettings().noiseControl.baselineRms ?? 0;
  });
  const [noiseBaseline, setNoiseBaseline] = useState<number>(() => {
    const s = getAppSettings().noiseControl;
    return s.baselineRms > 0 ? s.baselineDisplayDb : 0;
  });
  const [baselineRms, setBaselineRms] = useState<number>(() => {
    return getAppSettings().noiseControl.baselineRms ?? 0;
  });
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [calibrationProgress, setCalibrationProgress] = useState<number>(0);
  const [, setCalibrationError] = useState<string | null>(null);
  const [autoPopupReport, setAutoPopupReport] = useState<boolean>(
    () => getNoiseReportSettings().autoPopup
  );
  const [reportRetentionDays, setReportRetentionDays] = useState<number>(
    () => getNoiseReportSettings().retentionDays
  );
  const [maxReportRetentionDays, setMaxReportRetentionDays] = useState<number | null>(null);

  // 噪音控制（自动噪音限制 & 手动基准噪音）
  const initialControl = getNoiseControlSettings();
  const [draftMaxNoiseLevel, setDraftMaxNoiseLevel] = useState<number>(initialControl.maxLevelDb);
  const [draftManualBaselineDb, setDraftManualBaselineDb] = useState<number>(
    initialControl.baselineDb
  );
  const [draftShowRealtimeDb, setDraftShowRealtimeDb] = useState<boolean>(
    initialControl.showRealtimeDb
  );
  const [draftAvgWindowSec, setDraftAvgWindowSec] = useState<number>(initialControl.avgWindowSec);
  const [draftAlertSoundEnabled, setDraftAlertSoundEnabled] = useState<boolean>(
    initialControl.alertSoundEnabled ?? false
  );

  const openMessagePopup = useCallback(
    (detail: { type: "general" | "error"; title: string; message: string }) => {
      if (detail.type === "error") {
        pushErrorCenterRecord({
          level: "error",
          source: "noise",
          title: detail.title,
          message: detail.message,
        });
        if (!study.errorPopupEnabled) return;
      }
      window.dispatchEvent(
        new CustomEvent("messagePopup:open", {
          detail,
        })
      );
    },
    [study.errorPopupEnabled]
  );

  // 初始化噪音设置为草稿
  useEffect(() => {
    const noiseSettings = getAppSettings().noiseControl;
    const currentControl = getNoiseControlSettings();
    setEffectiveBaselineRms(noiseSettings.baselineRms ?? 0);
    setBaselineRms(noiseSettings.baselineRms ?? 0);
    setNoiseBaseline(noiseSettings.baselineRms > 0 ? noiseSettings.baselineDisplayDb : 0);
    setAutoPopupReport(getNoiseReportSettings().autoPopup);
    setReportRetentionDays(getNoiseReportSettings().retentionDays);
    setDraftMaxNoiseLevel(currentControl.maxLevelDb);
    setDraftManualBaselineDb(currentControl.baselineDb);
    setDraftShowRealtimeDb(currentControl.showRealtimeDb);
    setDraftAvgWindowSec(currentControl.avgWindowSec);
    setDraftAlertSoundEnabled(currentControl.alertSoundEnabled ?? false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const maxDays = await estimateMaxRetentionDaysByQuota();
      if (cancelled) return;
      setMaxReportRetentionDays(maxDays);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 在已存在 RMS 校准的情况下，当前校准显示应与滑块的显示基准保持同步
  useEffect(() => {
    if (baselineRms > 0) {
      setNoiseBaseline(draftManualBaselineDb);
    }
  }, [draftManualBaselineDb, baselineRms]);

  // 订阅“已生效基线”的变更：用于显示当前生效的 RMS（保存后/自动校准后都能实时刷新）
  useEffect(() => {
    const off = subscribeSettingsEvent(SETTINGS_EVENTS.NoiseBaselineUpdated, (evt: CustomEvent) => {
      try {
        const detail = evt.detail as { baselineRms?: unknown } | undefined;
        const nextRms =
          detail && typeof detail.baselineRms === "number" ? detail.baselineRms : undefined;
        if (typeof nextRms === "number") {
          setEffectiveBaselineRms(nextRms);
          return;
        }
        setEffectiveBaselineRms(getAppSettings().noiseControl.baselineRms ?? 0);
      } catch {
        setEffectiveBaselineRms(getAppSettings().noiseControl.baselineRms ?? 0);
      }
    });
    return off;
  }, []);

  const handleClearNoiseBaseline = useCallback(() => {
    if (confirm("确定要清除噪音校准吗？这将重置为未校准状态。")) {
      setNoiseBaseline(0);
      setBaselineRms(0);
      openMessagePopup({ type: "general", title: "提示", message: "噪音校准已清除（未保存）" });
    }
  }, [openMessagePopup]);

  const performCalibration = useCallback(async () => {
    setCalibrationError(null);
    setIsCalibrating(true);
    setCalibrationProgress(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const audioContextCtor = window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const Ctor = audioContextCtor.AudioContext || audioContextCtor.webkitAudioContext;
      if (!Ctor) {
        logger.warn("当前环境不支持 WebAudio");
        return;
      }
      const audioContext = new Ctor();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.25;
      // 简易A加权近似：80Hz高通 + 8kHz低通
      const highpass = audioContext.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 80;
      highpass.Q.value = 0.7;
      const lowpass = audioContext.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 8000;
      lowpass.Q.value = 0.7;

      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(analyser);

      const rmsSamples: number[] = [];
      const sampleDuration = 3000;
      const sampleInterval = 100;
      const totalSamples = Math.floor(sampleDuration / sampleInterval);

      for (let i = 0; i < totalSamples; i++) {
        await new Promise((resolve) => setTimeout(resolve, sampleInterval));
        const dataArray = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(dataArray);
        let sumSq = 0;
        for (let j = 0; j < dataArray.length; j++) {
          const v = dataArray[j];
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / dataArray.length);
        const clampedRms = Math.max(rms, 1e-6);
        rmsSamples.push(clampedRms);
        setCalibrationProgress(Math.round(((i + 1) / totalSamples) * 100));
      }

      microphone.disconnect();
      highpass.disconnect();
      lowpass.disconnect();
      audioContext.close();
      stream.getTracks().forEach((track) => track.stop());

      if (rmsSamples.length > 0) {
        const avgRms = rmsSamples.reduce((s, x) => s + x, 0) / rmsSamples.length;
        setBaselineRms(avgRms);
        // 使用当前手动显示基准作为校准后的显示基线
        setNoiseBaseline(draftManualBaselineDb);
        openMessagePopup({
          type: "general",
          title: "噪音校准完成",
          message: `基准值设置为 ${draftManualBaselineDb}dB（未保存）`,
        });
      } else {
        throw new Error("校准过程中未能获取有效的音频数据");
      }
    } catch (error) {
      logger.error("校准失败:", error);
      if (error instanceof Error) {
        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
          const isElectronRuntime = (() => {
            try {
              return typeof navigator !== "undefined" && /electron/i.test(navigator.userAgent);
            } catch {
              return false;
            }
          })();
          const msg = isElectronRuntime
            ? "需要麦克风权限才能进行噪音校准（请在系统设置中允许麦克风）"
            : "需要麦克风权限才能进行噪音校准";
          setCalibrationError(msg);
          openMessagePopup({ type: "error", title: "校准失败", message: msg });
        } else {
          setCalibrationError(error.message);
          openMessagePopup({ type: "error", title: "校准失败", message: error.message });
        }
      } else {
        setCalibrationError("未知错误");
        openMessagePopup({ type: "error", title: "校准失败", message: "未知错误" });
      }
    } finally {
      setIsCalibrating(false);
    }
  }, [draftManualBaselineDb, openMessagePopup]);

  const handleRecalibrate = useCallback(async () => {
    if (isCalibrating) return;
    if (confirm("确定要开始/重新校准噪音基准吗？请确保当前环境安静，校准过程约3秒。")) {
      await performCalibration();
    }
  }, [performCalibration, isCalibrating]);

  // 课表编辑功能已迁移到基础设置面板
  // 注册保存：在父组件点击保存时统一写入持久化存储
  useEffect(() => {
    onRegisterSave?.(() => {
      // 噪音基线：统一持久化为 RMS 与显示DB
      if (baselineRms > 0) {
        updateNoiseSettings({
          baselineRms,
          baselineDisplayDb: draftManualBaselineDb,
        });
        setEffectiveBaselineRms(baselineRms);
        // 广播基线更新，便于其他组件立即刷新
        broadcastSettingsEvent(SETTINGS_EVENTS.NoiseBaselineUpdated, {
          baselineDb: draftManualBaselineDb,
          baselineRms,
        });
      } else {
        updateNoiseSettings({
          baselineRms: 0,
          baselineDisplayDb: 0,
        });
        setEffectiveBaselineRms(0);
        broadcastSettingsEvent(SETTINGS_EVENTS.NoiseBaselineUpdated, {
          baselineDb: 0,
          baselineRms: 0,
        });
      }

      // 自动弹出报告设置
      setAutoPopupSetting(autoPopupReport);
      if (maxReportRetentionDays && maxReportRetentionDays > 0) {
        setRetentionDaysSetting(Math.max(1, Math.min(maxReportRetentionDays, reportRetentionDays)));
      } else {
        setRetentionDaysSetting(Math.max(1, reportRetentionDays));
      }
      // 噪音控制设置
      saveNoiseControlSettings({
        maxLevelDb: draftMaxNoiseLevel,
        baselineDb: draftManualBaselineDb,
        showRealtimeDb: draftShowRealtimeDb,
        avgWindowSec: draftAvgWindowSec,
        alertSoundEnabled: draftAlertSoundEnabled,
      });
    });
  }, [
    onRegisterSave,
    baselineRms,
    autoPopupReport,
    reportRetentionDays,
    maxReportRetentionDays,
    draftManualBaselineDb,
    draftMaxNoiseLevel,
    draftShowRealtimeDb,
    draftAvgWindowSec,
    draftAlertSoundEnabled,
  ]);

  // 课表重置功能已迁移到基础设置面板

  return (
    <div id="study-panel" role="tabpanel" aria-labelledby="study">
      <FormSection title="噪音控制">
        <p className={styles.helpText}>仅用于调整噪音状态的显示与提示音触发，不会影响评分结果。</p>

        <FormRow gap="md" align="start">
          <div style={{ flex: 1, paddingRight: 15 }}>
            <FormSlider
              label="判定阈值"
              value={draftMaxNoiseLevel}
              min={40}
              max={80}
              step={1}
              onChange={setDraftMaxNoiseLevel}
              formatValue={(v: number) => `${v.toFixed(0)}dB`}
              showRange={true}
              rangeLabels={["40dB", "80dB"]}
            />
            <p className={styles.helpText} style={{ marginTop: 4 }}>
              环境声音超过此值时会显示为“吵闹”，并在开启提示音时播放提示音（不影响评分）。
            </p>
          </div>

          <div style={{ flex: 1, paddingLeft: 15 }}>
            <FormSlider
              label="噪音数值平滑"
              value={draftAvgWindowSec}
              min={0.5}
              max={10}
              step={0.5}
              onChange={setDraftAvgWindowSec}
              formatValue={(v: number) => `${v.toFixed(1)}秒`}
              showRange={true}
              rangeLabels={["灵敏", "平缓"]}
            />
            <p className={styles.helpText} style={{ marginTop: 4 }}>
              数值越大，数字跳动越平缓。
            </p>
          </div>
        </FormRow>

        <FormRow gap="sm" align="center">
          <FormCheckbox
            label="显示实时分贝"
            checked={draftShowRealtimeDb}
            onChange={(e) => setDraftShowRealtimeDb(e.target.checked)}
          />
        </FormRow>

        <FormRow gap="sm" align="center">
          <FormCheckbox
            label="超过阈值播放提示音"
            checked={draftAlertSoundEnabled}
            onChange={(e) => setDraftAlertSoundEnabled(e.target.checked)}
          />
        </FormRow>
      </FormSection>

      <FormSection title="校准与修正">
        <div data-tour="noise-calibration">
          <p className={styles.helpText}>
            请一定在安静环境下校准，或手动选择你认为当前环境所处的噪音水平。(需要麦克风权限)
          </p>

          {/* 手动构建 Slider 头部以实现自定义布局 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 4,
              fontSize: "14px",
              color: "var(--text-primary)",
            }}
          >
            <span>基准噪音值</span>
            <span>{draftManualBaselineDb.toFixed(0)}dB</span>
          </div>

          <FormRow gap="md" align="center">
            <div
              className={styles.noiseCalibrationInfo}
              style={{
                margin: 0,
                padding: "0 12px",
                height: "36px", // 与 Slider 轨道区域高度大致匹配
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "auto",
                borderRadius: "4px",
              }}
            >
              <p
                className={styles.infoText}
                style={{ margin: 0, fontSize: "13px" }}
                data-tour="noise-calibration-status"
              >
                <span
                  className={`${styles.statusDot} ${baselineRms > 0 ? styles.statusCalibrated : styles.statusUncalibrated}`}
                />
                {baselineRms > 0 ? "已校准" : "未校准"}
                {isCalibrating && ` (${calibrationProgress}%)`}
              </p>
            </div>

            <div style={{ flex: 1 }} id="tour-noise-baseline-slider">
              <FormSlider
                // 移除 label 以隐藏内置头部
                value={draftManualBaselineDb}
                min={30}
                max={60}
                step={1}
                onChange={setDraftManualBaselineDb}
                showRange={false}
                className={styles.compactSlider} // 可选：如果需要微调样式
              />
            </div>
          </FormRow>

          <FormButtonGroup align="left">
            <FormButton
              id="tour-noise-calibrate-btn"
              variant="secondary"
              onClick={handleRecalibrate}
              disabled={isCalibrating}
              icon={<VolumeIcon size={16} />}
            >
              {noiseBaseline > 0 ? "重新校准" : "开始校准"}
            </FormButton>
            <FormButton
              variant="danger"
              onClick={handleClearNoiseBaseline}
              disabled={noiseBaseline === 0 && baselineRms === 0}
              icon={<VolumeMuteIcon size={16} />}
            >
              清除校准
            </FormButton>
          </FormButtonGroup>
        </div>
      </FormSection>

      <FormSection title="噪音报告">
        <FormRow gap="sm" align="center">
          <FormCheckbox
            label="自动弹出报告"
            checked={autoPopupReport}
            onChange={(e) => {
              const checked = e.target.checked;
              setAutoPopupReport(checked);
            }}
          />
        </FormRow>
        <FormRow gap="sm" align="center">
          <FormInput
            label="历史保存天数"
            type="number"
            value={String(reportRetentionDays)}
            onChange={(e) => {
              const next = parseInt(e.target.value, 10);
              const normalized = Number.isFinite(next) ? Math.max(1, next) : 1;
              const capped =
                maxReportRetentionDays && maxReportRetentionDays > 0
                  ? Math.min(maxReportRetentionDays, normalized)
                  : normalized;
              setReportRetentionDays(capped);
            }}
            min={1}
            max={maxReportRetentionDays ?? undefined}
          />
        </FormRow>
        <p className={styles.helpText}>学习结束后自动显示噪音分析报告。</p>
        <p className={styles.helpText}>
          默认 {DEFAULT_NOISE_REPORT_RETENTION_DAYS}{" "}
          天；实际最大可保存范围会受本地容量限制（按可用容量的 90% 自动裁剪旧数据）。
          {maxReportRetentionDays ? ` 当前建议上限：${maxReportRetentionDays} 天。` : ""}
        </p>
      </FormSection>

      {/* 背景设置已迁移到基础设置 */}

      <FormSection title="实时监控">
        <RealTimeNoiseChart />
      </FormSection>
      <FormSection title="统计数据">
        <NoiseStatsSummary />
      </FormSection>
    </div>
  );
};

export default StudySettingsPanel;
