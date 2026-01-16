import React, { useCallback, useEffect, useState } from "react";

import { getAppSettings, updateNoiseSettings } from "../../../utils/appSettings";
import { logger } from "../../../utils/logger";
import {
  getNoiseControlSettings,
  saveNoiseControlSettings,
} from "../../../utils/noiseControlSettings";
import { getNoiseReportSettings, setAutoPopupSetting } from "../../../utils/noiseReportSettings";
import { broadcastSettingsEvent, SETTINGS_EVENTS, subscribeSettingsEvent } from "../../../utils/settingsEvents";
import {
  FormSection,
  FormButton,
  FormButtonGroup,
  FormCheckbox,
  FormSlider,
} from "../../FormComponents";
import { VolumeIcon, VolumeMuteIcon } from "../../Icons";
import NoiseStatsSummary from "../../NoiseSettings/NoiseStatsSummary";
import RealTimeNoiseChart from "../../NoiseSettings/RealTimeNoiseChart";
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
  const [effectiveBaselineRms, setEffectiveBaselineRms] = useState<number>(() => {
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
  const [calibrationError, setCalibrationError] = useState<string | null>(null);
  const [autoPopupReport, setAutoPopupReport] = useState<boolean>(
    () => getNoiseReportSettings().autoPopup
  );

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

  const formatRmsValue = useCallback((value: number): string => {
    return value.toExponential(3);
  }, []);

  // 初始化噪音设置为草稿
  useEffect(() => {
    const noiseSettings = getAppSettings().noiseControl;
    const currentControl = getNoiseControlSettings();
    setEffectiveBaselineRms(noiseSettings.baselineRms ?? 0);
    setBaselineRms(noiseSettings.baselineRms ?? 0);
    setNoiseBaseline(noiseSettings.baselineRms > 0 ? noiseSettings.baselineDisplayDb : 0);
    setAutoPopupReport(getNoiseReportSettings().autoPopup);
    setDraftMaxNoiseLevel(currentControl.maxLevelDb);
    setDraftManualBaselineDb(currentControl.baselineDb);
    setDraftShowRealtimeDb(currentControl.showRealtimeDb);
    setDraftAvgWindowSec(currentControl.avgWindowSec);
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
        const nextRms = detail && typeof detail.baselineRms === "number" ? detail.baselineRms : undefined;
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
      alert("噪音校准已清除（未保存）");
    }
  }, []);

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
        alert(`噪音校准完成！基准值设置为 ${draftManualBaselineDb}dB（未保存）`);
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
          alert(`校准失败：${msg}`);
        } else {
          setCalibrationError(error.message);
          alert(`校准失败：${error.message}`);
        }
      } else {
        setCalibrationError("未知错误");
        alert("校准失败：未知错误");
      }
    } finally {
      setIsCalibrating(false);
    }
  }, [draftManualBaselineDb]);

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
      // 噪音控制设置
      saveNoiseControlSettings({
        maxLevelDb: draftMaxNoiseLevel,
        baselineDb: draftManualBaselineDb,
        showRealtimeDb: draftShowRealtimeDb,
        avgWindowSec: draftAvgWindowSec,
      });
    });
  }, [
    onRegisterSave,
    baselineRms,
    autoPopupReport,
    draftManualBaselineDb,
    draftMaxNoiseLevel,
    draftShowRealtimeDb,
    draftAvgWindowSec,
  ]);

  // 课表重置功能已迁移到基础设置面板

  return (
    <div className={styles.settingsGroup} id="study-panel" role="tabpanel" aria-labelledby="study">
      <h3 className={styles.groupTitle}>监测设置</h3>

      <FormSection title="噪音控制">
        <div className={styles.noiseCalibrationInfo}>
          <p className={styles.infoText}>
            自动噪音限制：最大允许 {draftMaxNoiseLevel.toFixed(0)}dB
          </p>
          <p className={styles.helpText}>超过该阈值时将判定为“吵闹”，用于提醒与报告统计。</p>
        </div>
        <FormSlider
          label="最大允许噪音级别"
          value={draftMaxNoiseLevel}
          min={40}
          max={80}
          step={1}
          onChange={setDraftMaxNoiseLevel}
          formatValue={(v: number) => `${v.toFixed(0)}dB`}
          showRange={true}
          rangeLabels={["40dB", "80dB"]}
        />
        <FormCheckbox
          label="显示实时分贝"
          checked={draftShowRealtimeDb}
          onChange={(e) => setDraftShowRealtimeDb(e.target.checked)}
        />
        <FormSlider
          label="噪音平均时间窗"
          value={draftAvgWindowSec}
          min={0.5}
          max={10}
          step={0.5}
          onChange={setDraftAvgWindowSec}
          formatValue={(v: number) => `${v.toFixed(1)}秒`}
          showRange={true}
          rangeLabels={["0.5秒", "10秒"]}
        />
        <p className={styles.helpText}>显示与存储均采用该时间窗的平均值，默认 1 秒。</p>
      </FormSection>

      <FormSection title="噪音基准与校准">
        <div className={styles.noiseCalibrationInfo}>
          <p className={styles.infoText}>显示基准：{draftManualBaselineDb.toFixed(0)}dB</p>
          <p className={styles.helpText}>
            显示基准用于相对 dB 映射；与校准得到的 RMS 结合后，形成稳定且可比较的分贝显示。
          </p>
        </div>
        <FormSlider
          label="基准噪音显示值"
          value={draftManualBaselineDb}
          min={30}
          max={60}
          step={1}
          onChange={setDraftManualBaselineDb}
          formatValue={(v: number) => `${v.toFixed(0)}dB`}
          showRange={true}
          rangeLabels={["30dB", "60dB"]}
        />

        <div className={styles.noiseCalibrationInfo}>
          <p className={styles.infoText}>
            <span
              className={`${styles.statusDot} ${baselineRms > 0 ? styles.statusCalibrated : styles.statusUncalibrated}`}
              aria-label={baselineRms > 0 ? "已校准" : "未校准"}
              title={baselineRms > 0 ? "已校准" : "未校准"}
            />
            当前校准：{noiseBaseline > 0 ? `${noiseBaseline.toFixed(1)}dB 基准` : "未校准"}
          </p>
          <p className={styles.helpText}>
            当前生效 RMS：{effectiveBaselineRms > 0 ? formatRmsValue(effectiveBaselineRms) : "未校准"}
          </p>
          <p className={styles.helpText}>
            校准会采样约 3 秒的环境声音并计算
            RMS；显示将以上方的“基准噪音显示值”作为基准进行映射，使不同设备下的监测更稳定、更可比较。
          </p>
          {isCalibrating && (
            <p className={styles.helpText} aria-live="polite">
              正在校准… 进度 {calibrationProgress}% ，请保持环境安静。
            </p>
          )}
          {calibrationError && <p className={styles.errorText}>校准失败：{calibrationError}</p>}
        </div>
        <FormButtonGroup align="left">
          <FormButton
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
      </FormSection>

      <FormSection title="噪音报告设置">
        <FormCheckbox
          label="自动弹出噪音报告"
          checked={autoPopupReport}
          onChange={(e) => {
            const checked = e.target.checked;
            setAutoPopupReport(checked);
          }}
        />
        <p className={styles.helpText}>
          开启后，在学习结束时会自动弹出噪音报告界面。关闭后，需要手动点击噪音状态文字查看报告。
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
