import React, { useEffect, useMemo, useState } from "react";

import { DEFAULT_NOISE_REPORT_RETENTION_DAYS } from "../../constants/noiseReport";
import type { NoiseSliceSummary } from "../../types/noise";
import { StudyPeriod, DEFAULT_SCHEDULE } from "../../types/studySchedule";
import { formatDateTimeLocal, parseDateTimeLocal } from "../../utils/dateTimeLocal";
import { buildNoiseHistoryListItems } from "../../utils/noiseHistoryBuilder";
import { getNoiseReportSettings } from "../../utils/noiseReportSettings";
import { readNoiseSlices, subscribeNoiseSlicesUpdated } from "../../utils/noiseSliceService";
import { readStudySchedule } from "../../utils/studyScheduleStorage";
import { FormButton, FormButtonGroup, FormInput, FormRow, FormSection } from "../FormComponents";
import Modal from "../Modal/Modal";
import type { NoiseReportPeriod } from "../NoiseReportModal/NoiseReportModal";

import styles from "./NoiseHistoryModal.module.css";

export interface NoiseHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewDetail: (period: NoiseReportPeriod) => void;
}

function formatRange(start: Date, end: Date): string {
  return `${start.toLocaleString()} - ${end.toLocaleString()}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const NoiseHistoryModal: React.FC<NoiseHistoryModalProps> = ({ isOpen, onClose, onViewDetail }) => {
  const [tick, setTick] = useState(0);
  const [customName, setCustomName] = useState("自定义报告");
  const [customStartValue, setCustomStartValue] = useState("");
  const [customEndValue, setCustomEndValue] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = subscribeNoiseSlicesUpdated(() => setTick((t) => t + 1));
    setTick((t) => t + 1);
    return unsubscribe;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const end = new Date();
    end.setSeconds(0, 0);
    const start = new Date(end.getTime() - 60 * 60 * 1000);
    setCustomName("自定义报告");
    setCustomStartValue(formatDateTimeLocal(start));
    setCustomEndValue(formatDateTimeLocal(end));
    setCustomError(null);
    setCustomOpen(false);
  }, [isOpen]);

  const slices: NoiseSliceSummary[] = useMemo(() => {
    void tick;
    if (!isOpen) return [];
    return readNoiseSlices();
  }, [isOpen, tick]);

  const retentionDays = useMemo(() => {
    void tick;
    if (!isOpen) return DEFAULT_NOISE_REPORT_RETENTION_DAYS;
    return getNoiseReportSettings().retentionDays;
  }, [isOpen, tick]);

  const maxCustomRangeMs = Math.max(1, Math.round(retentionDays)) * DAY_MS;

  const availableRange = useMemo(() => {
    if (!isOpen) return null;
    if (slices.length === 0) return null;
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const s of slices) {
      if (s.start < minStart) minStart = s.start;
      if (s.end > maxEnd) maxEnd = s.end;
    }
    if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd) || maxEnd <= minStart) return null;
    return { min: new Date(minStart), max: new Date(maxEnd) };
  }, [isOpen, slices]);

  const items = useMemo(() => {
    if (!isOpen) return [];
    let schedule: StudyPeriod[] = DEFAULT_SCHEDULE;
    try {
      const s = readStudySchedule();
      if (Array.isArray(s) && s.length > 0) schedule = s;
    } catch {}
    return buildNoiseHistoryListItems({ slices, schedule, windowMs: maxCustomRangeMs });
  }, [isOpen, slices, maxCustomRangeMs]);

  /** 查看自定义报告（函数级注释：校验起止时间并回传 NoiseReportPeriod，让上层复用统一报告弹窗展示） */
  const handleViewCustomReport = () => {
    setCustomError(null);
    const start = parseDateTimeLocal(customStartValue);
    const end = parseDateTimeLocal(customEndValue);
    if (!start || !end) {
      setCustomError("请输入有效的开始/结束时间。");
      setCustomOpen(true);
      return;
    }
    const startTs = start.getTime();
    const endTs = end.getTime();
    if (endTs <= startTs) {
      setCustomError("结束时间必须晚于开始时间。");
      setCustomOpen(true);
      return;
    }
    if (endTs - startTs > maxCustomRangeMs) {
      setCustomError(`当前仅支持查看最近 ${retentionDays} 天内的时间段报告。`);
      setCustomOpen(true);
      return;
    }
    const name = customName.trim().length > 0 ? customName.trim() : "自定义报告";
    onViewDetail({
      id: `custom-${startTs}-${endTs}`,
      name,
      start,
      end,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="历史记录管理"
      maxWidth="xxl"
      closeButtonDataTour="noise-history-close"
    >
      <div data-tour="noise-history-modal">
        <FormSection title={`历史记录（最近${retentionDays}天）`}>
          <div className={styles.note}>
            数据来源：噪音切片摘要（按“历史保存天数”保存，且会受本地容量限制自动裁剪）。
          </div>

          <div className={styles.list} aria-live="polite">
            <div className={styles.headerRow}>
              <div className={styles.colName}>名称</div>
              <div className={styles.colScore}>评分</div>
              <div className={styles.colTime}>时间</div>
              <div className={styles.colAction}></div>
            </div>

            {items.length === 0 ? (
              <div className={styles.empty}>暂无历史记录</div>
            ) : (
              items.map((item) => (
                <div key={item.period.id} className={styles.dataRow}>
                  <div className={styles.colName}>{item.period.name}</div>
                  <div className={styles.colScore}>
                    {item.avgScore === null ? "—" : item.avgScore.toFixed(1)}
                  </div>
                  <div className={styles.colTime}>
                    {formatRange(item.period.start, item.period.end)}
                  </div>
                  <div className={styles.colAction}>
                    <FormButton
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        onViewDetail({
                          id: item.period.id,
                          name: item.period.name,
                          start: item.period.start,
                          end: item.period.end,
                        })
                      }
                    >
                      查看详情
                    </FormButton>
                  </div>
                </div>
              ))
            )}
          </div>

          <details
            className={styles.customDetails}
            open={customOpen}
            onToggle={(e) => setCustomOpen((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary className={styles.customSummary}>自定义时间段报告</summary>
            <div className={styles.customBody}>
              <div className={styles.note}>
                {availableRange
                  ? `可用数据范围：${formatRange(availableRange.min, availableRange.max)}`
                  : "当前暂无切片数据（生成报告后将显示统计）。"}
              </div>

              <div className={styles.customForm}>
                <FormInput
                  label="报告名称"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="例如：午间自习"
                />

                <FormRow gap="sm" align="end" className={styles.customRow}>
                  <FormInput
                    label="开始时间"
                    type="datetime-local"
                    value={customStartValue}
                    onChange={(e) => setCustomStartValue(e.target.value)}
                  />
                  <FormInput
                    label="结束时间"
                    type="datetime-local"
                    value={customEndValue}
                    onChange={(e) => setCustomEndValue(e.target.value)}
                  />
                </FormRow>

                <FormButtonGroup align="right">
                  <FormButton variant="primary" size="sm" onClick={handleViewCustomReport}>
                    查看报告
                  </FormButton>
                </FormButtonGroup>

                {customError ? <div className={styles.customError}>{customError}</div> : null}
              </div>
            </div>
          </details>
        </FormSection>
      </div>
    </Modal>
  );
};

export default NoiseHistoryModal;
