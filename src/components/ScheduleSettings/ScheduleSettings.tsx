import React, { useMemo, useState, useCallback, useEffect } from "react";

import { logger } from "../../utils/logger";
import { broadcastSettingsEvent, SETTINGS_EVENTS } from "../../utils/settingsEvents";
import {
  ExcelImportResult,
  parseStudyScheduleFromExcelArrayBuffer,
  rebaseStudyPeriodIds,
} from "../../utils/studyScheduleExcelImport";
import { readStudySchedule, writeStudySchedule } from "../../utils/studyScheduleStorage";
import {
  createNewStudyPeriod,
  getStudyPeriodDurationMinutes,
  parseTimeText,
  sortScheduleByStartTime,
  validateStudySchedule,
} from "../../utils/studyScheduleValidation";
import {
  FormSection,
  FormFilePicker,
  FormInput,
  FormButton,
  FormButtonGroup,
  FormRow,
} from "../FormComponents";
import { FileIcon, PlusIcon, RefreshIcon, ResetIcon, SaveIcon, TrashIcon } from "../Icons";
import { Modal } from "../Modal";
import { StudyPeriod, DEFAULT_SCHEDULE } from "../StudyStatus";

import styles from "./ScheduleSettings.module.css";

interface ScheduleSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (schedule: StudyPeriod[]) => void;
}

/**
 * 课程表配置组件
 * 功能：支持添加、修改、删除上课时间段
 */
const ScheduleSettings: React.FC<ScheduleSettingsProps> = ({ isOpen, onClose, onSave }) => {
  const [draftSchedule, setDraftSchedule] = useState<StudyPeriod[]>(DEFAULT_SCHEDULE);
  const [excelImport, setExcelImport] = useState<ExcelImportResult | null>(null);
  const [excelFileName, setExcelFileName] = useState<string>("");
  const [excelBusy, setExcelBusy] = useState(false);
  const [excelError, setExcelError] = useState<string>("");

  const validation = useMemo(() => validateStudySchedule(draftSchedule), [draftSchedule]);
  const excelValidation = useMemo(
    () => (excelImport ? validateStudySchedule(excelImport.periods) : null),
    [excelImport]
  );

  /**
   * 从localStorage加载课程表
   */
  const loadSchedule = useCallback(() => {
    const data = readStudySchedule();
    setDraftSchedule(Array.isArray(data) && data.length > 0 ? data : DEFAULT_SCHEDULE);
  }, []);

  /**
   * 保存课程表到localStorage
   */
  const saveSchedule = useCallback(
    (newSchedule: StudyPeriod[]) => {
      try {
        writeStudySchedule(newSchedule);
        broadcastSettingsEvent(SETTINGS_EVENTS.StudyScheduleUpdated, { schedule: newSchedule });
        onSave(newSchedule);
      } catch (error) {
        logger.error("保存课程表失败:", error);
      }
    },
    [onSave]
  );

  /**
   * 生成可保存的课表（函数级注释：统一时间格式为 HH:MM，并对名称做 trim 与自动补齐）
   */
  const toSavableSchedule = useCallback((input: StudyPeriod[]): StudyPeriod[] => {
    const normalized = validateStudySchedule(input).normalized;
    const sorted = sortScheduleByStartTime(normalized);
    return sorted.map((p, index) => {
      const start = parseTimeText(p.startTime);
      const end = parseTimeText(p.endTime);
      const safeName = typeof p.name === "string" ? p.name.trim() : "";
      return {
        ...p,
        startTime: start?.normalized ?? p.startTime,
        endTime: end?.normalized ?? p.endTime,
        name: safeName.length > 0 ? safeName : `自定义时段${index + 1}`,
      };
    });
  }, []);

  /**
   * 添加新的时间段
   */
  const handleAddPeriod = useCallback(() => {
    setDraftSchedule((prev) => [...prev, createNewStudyPeriod(prev)]);
  }, []);

  /** 复制时间段（函数级注释：复制当前行并生成新 id，便于快速创建相似时段） */
  const handleDuplicatePeriod = useCallback((id: string) => {
    setDraftSchedule((prev) => {
      const index = prev.findIndex((p) => p.id === id);
      if (index < 0) return prev;
      const base = prev[index];
      const copy: StudyPeriod = { ...base, id: String(Date.now()), name: `${base.name}` };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  }, []);

  /** 移动时间段（函数级注释：上移/下移仅影响当前显示顺序，不会在输入时自动排序） */
  const handleMovePeriod = useCallback((id: string, dir: "up" | "down") => {
    setDraftSchedule((prev) => {
      const index = prev.findIndex((p) => p.id === id);
      if (index < 0) return prev;
      const targetIndex = dir === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = tmp;
      return next;
    });
  }, []);

  /**
   * 删除时间段
   */
  const handleDeletePeriod = useCallback((id: string) => {
    setDraftSchedule((prev) => prev.filter((period) => period.id !== id));
  }, []);

  /**
   * 更新时间段
   */
  const handleUpdatePeriod = useCallback((id: string, field: keyof StudyPeriod, value: string) => {
    setDraftSchedule((prev) =>
      prev.map((period) => (period.id === id ? { ...period, [field]: value } : period))
    );
  }, []);

  /**
   * 保存并关闭
   */
  const handleSave = useCallback(() => {
    if (validation.hasErrors) return;
    const savable = toSavableSchedule(draftSchedule);
    setDraftSchedule(savable);
    saveSchedule(savable);
    onClose();
  }, [draftSchedule, saveSchedule, onClose, toSavableSchedule, validation.hasErrors]);

  /** 按开始时间排序（函数级注释：用户主动点击时才排序，避免输入时列表跳动） */
  const handleSortByTime = useCallback(() => {
    setDraftSchedule((prev) => sortScheduleByStartTime(prev));
  }, []);

  /** 恢复已保存（函数级注释：撤销本次弹窗内修改，重新从持久化加载） */
  const handleRestoreSaved = useCallback(() => {
    loadSchedule();
  }, [loadSchedule]);

  /**
   * 重置为默认课程表
   */
  const handleReset = useCallback(() => {
    if (confirm("确定要重置为默认课程表吗？")) {
      setDraftSchedule(DEFAULT_SCHEDULE);
    }
  }, []);

  // 组件打开时加载课程表
  useEffect(() => {
    if (isOpen) {
      loadSchedule();
      setExcelImport(null);
      setExcelFileName("");
      setExcelBusy(false);
      setExcelError("");
    }
  }, [isOpen, loadSchedule]);

  /** 处理 Excel 文件选择（函数级注释：读取 ArrayBuffer 并解析出课表预览与行级错误） */
  const handleExcelFileChange = useCallback(async (file: File | null) => {
    setExcelImport(null);
    setExcelError("");
    setExcelFileName(file?.name ?? "");
    if (!file) return;
    try {
      setExcelBusy(true);
      const buffer = await file.arrayBuffer();
      const result = parseStudyScheduleFromExcelArrayBuffer(buffer);
      setExcelImport(result);
    } catch (e) {
      setExcelError(e instanceof Error ? e.message : "解析 Excel 失败");
    } finally {
      setExcelBusy(false);
    }
  }, []);

  /** 应用导入结果（函数级注释：支持替换当前课表或合并追加到当前课表） */
  const applyExcelImport = useCallback(
    (mode: "replace" | "append") => {
      if (!excelImport) return;
      if (mode === "replace") {
        setDraftSchedule(excelImport.periods);
        return;
      }
      setDraftSchedule((prev) => [
        ...prev,
        ...rebaseStudyPeriodIds(excelImport.periods, String(Date.now())),
      ]);
    },
    [excelImport]
  );

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="课程表设置"
      maxWidth="lg"
      footer={
        <FormButtonGroup align="left">
          <FormButton
            variant="secondary"
            onClick={handleRestoreSaved}
            icon={<RefreshIcon size={16} />}
          >
            恢复已保存
          </FormButton>
          <FormButton
            variant="secondary"
            onClick={handleSortByTime}
            icon={<RefreshIcon size={16} />}
          >
            按时间排序
          </FormButton>
          <FormButton variant="secondary" onClick={handleReset} icon={<ResetIcon size={16} />}>
            重置默认
          </FormButton>
          <FormButtonGroup>
            <FormButton variant="secondary" onClick={onClose}>
              取消
            </FormButton>
            <FormButton
              variant="primary"
              onClick={handleSave}
              icon={<SaveIcon size={16} />}
              disabled={validation.hasErrors}
            >
              保存
            </FormButton>
          </FormButtonGroup>
        </FormButtonGroup>
      }
    >
      <FormSection title="Excel 导入">
        <FormFilePicker
          label="选择 Excel 文件（.xlsx / .xls）"
          accept=".xlsx,.xls"
          buttonText={excelBusy ? "解析中..." : "选择文件"}
          placeholder="未选择文件"
          fileName={excelFileName}
          disabled={excelBusy}
          onFileChange={handleExcelFileChange}
        />
        {excelError && <div className={styles.importError}>{excelError}</div>}
        {excelImport && (
          <div className={styles.importSummary}>
            <div className={styles.importSummaryRow}>
              <span>工作表：</span>
              <span className={styles.importSummaryValue}>{excelImport.meta.sheetName || "-"}</span>
            </div>
            <div className={styles.importSummaryRow}>
              <span>解析结果：</span>
              <span className={styles.importSummaryValue}>
                成功 {excelImport.periods.length} 行，失败 {excelImport.rowErrors.length} 行
              </span>
            </div>
            {excelImport.rowErrors.length > 0 && (
              <div className={styles.importErrors}>
                {excelImport.rowErrors.slice(0, 6).map((e) => (
                  <div key={`${e.rowNumber}-${e.message}`} className={styles.importErrorItem}>
                    第 {e.rowNumber} 行：{e.message}
                  </div>
                ))}
                {excelImport.rowErrors.length > 6 && (
                  <div className={styles.importErrorMore}>更多错误已省略…</div>
                )}
              </div>
            )}
            {excelValidation?.hasErrors && (
              <div className={styles.importHint}>
                导入数据可能存在时间冲突，应用后需要在下方修正。
              </div>
            )}
            <div className={styles.importActions}>
              <FormButton
                variant="primary"
                icon={<FileIcon size={16} />}
                onClick={() => applyExcelImport("replace")}
                disabled={excelBusy || excelImport.periods.length === 0}
              >
                替换当前课表
              </FormButton>
              <FormButton
                variant="secondary"
                onClick={() => applyExcelImport("append")}
                disabled={excelBusy || excelImport.periods.length === 0}
              >
                合并追加
              </FormButton>
            </div>
          </div>
        )}
      </FormSection>

      <FormSection title="课程时间表">
        {validation.globalErrors.length > 0 && (
          <div className={styles.globalErrors}>
            {validation.globalErrors.map((msg) => (
              <div key={msg} className={styles.globalErrorItem}>
                {msg}
              </div>
            ))}
          </div>
        )}
        {validation.hasErrors && (
          <div className={styles.globalHint}>
            请修正红色提示后再保存（可先按“按时间排序”快速定位冲突）。
          </div>
        )}
        <div className={styles.scheduleList}>
          {draftSchedule.map((period, index) => {
            const itemErrors = validation.errors[period.id] ?? {};
            const duration = getStudyPeriodDurationMinutes(period);
            return (
              <div key={period.id} className={styles.periodItem}>
                <div className={styles.periodNumber}>{index + 1}</div>
                <div className={styles.periodInputs}>
                  <FormInput
                    type="text"
                    value={period.name}
                    onChange={(e) => handleUpdatePeriod(period.id, "name", e.target.value)}
                    placeholder="课程名称"
                  />
                  <FormRow gap="sm">
                    <FormInput
                      type="time"
                      value={period.startTime}
                      onChange={(e) => handleUpdatePeriod(period.id, "startTime", e.target.value)}
                      variant="time"
                      error={itemErrors.startTime}
                    />
                    <span className={styles.timeSeparator}>-</span>
                    <FormInput
                      type="time"
                      value={period.endTime}
                      onChange={(e) => handleUpdatePeriod(period.id, "endTime", e.target.value)}
                      variant="time"
                      error={itemErrors.endTime}
                    />
                    <div className={styles.periodMeta}>
                      <span className={styles.durationText}>
                        {typeof duration === "number" ? `${duration} 分钟` : "--"}
                      </span>
                    </div>
                  </FormRow>
                  {itemErrors.row && <div className={styles.rowError}>{itemErrors.row}</div>}
                </div>
                <div className={styles.rowActions}>
                  <FormButton
                    variant="secondary"
                    size="sm"
                    onClick={() => handleMovePeriod(period.id, "up")}
                    disabled={index === 0}
                  >
                    上移
                  </FormButton>
                  <FormButton
                    variant="secondary"
                    size="sm"
                    onClick={() => handleMovePeriod(period.id, "down")}
                    disabled={index === draftSchedule.length - 1}
                  >
                    下移
                  </FormButton>
                  <FormButton
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDuplicatePeriod(period.id)}
                  >
                    复制
                  </FormButton>
                  <FormButton
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeletePeriod(period.id)}
                    icon={<TrashIcon size={16} />}
                    title="删除时间段"
                  >
                    删除
                  </FormButton>
                </div>
              </div>
            );
          })}
        </div>

        <FormButtonGroup align="center">
          <FormButton variant="primary" onClick={handleAddPeriod} icon={<PlusIcon size={16} />}>
            添加时间段
          </FormButton>
        </FormButtonGroup>
      </FormSection>
    </Modal>
  );
};

export default ScheduleSettings;
