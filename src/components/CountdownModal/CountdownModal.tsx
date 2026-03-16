import React, { useState, useCallback, useEffect } from "react";

import { useAppState, useAppDispatch } from "../../contexts/AppContext";
import { timeToSeconds } from "../../utils/formatTime";
import { FormSection, FormButton, FormButtonGroup } from "../FormComponents";
import { PlusIcon, MinusIcon } from "../Icons";
import { Modal } from "../Modal";

import styles from "./CountdownModal.module.css";

/**
 * 倒计时设置模态框组件
 * 允许用户设置倒计时的小时、分钟和秒数
 */
export function CountdownModal() {
  const { isModalOpen } = useAppState();
  const dispatch = useAppDispatch();

  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(10);
  const [seconds, setSeconds] = useState(0);

  /**
   * 关闭模态框
   */
  const handleClose = useCallback(() => {
    dispatch({ type: "CLOSE_MODAL" });
  }, [dispatch]);

  /**
   * 确认设置倒计时
   */
  const handleConfirm = useCallback(() => {
    const totalSeconds = timeToSeconds(hours, minutes, seconds);
    if (totalSeconds > 0) {
      dispatch({ type: "SET_COUNTDOWN", payload: totalSeconds });
      handleClose();
    }
  }, [hours, minutes, seconds, dispatch, handleClose]);

  /**
   * 设置预设时间
   */
  const handlePreset = useCallback((presetMinutes: number) => {
    const presetHours = Math.floor(presetMinutes / 60);
    const remainingMinutes = presetMinutes % 60;
    setHours(presetHours);
    setMinutes(remainingMinutes);
    setSeconds(0);
  }, []);

  /**
   * 调整时间值
   */
  const adjustTime = useCallback((type: "hours" | "minutes" | "seconds", delta: number) => {
    switch (type) {
      case "hours":
        setHours((prev) => Math.max(0, Math.min(23, prev + delta)));
        break;
      case "minutes":
        setMinutes((prev) => Math.max(0, Math.min(59, prev + delta)));
        break;
      case "seconds":
        setSeconds((prev) => Math.max(0, Math.min(59, prev + delta)));
        break;
    }
  }, []);

  /**
   * 处理键盘事件
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isModalOpen) return;

      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "Enter") {
        handleConfirm();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, handleClose, handleConfirm]);

  if (!isModalOpen) {
    return null;
  }

  const totalSeconds = timeToSeconds(hours, minutes, seconds);
  const isValid = totalSeconds > 0;

  const presets = [
    { label: "10分钟", minutes: 10 },
    { label: "30分钟", minutes: 30 },
    { label: "1小时", minutes: 60 },
    { label: "1小时15分", minutes: 75 },
    { label: "2小时", minutes: 120 },
  ];

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={handleClose}
      title="设置倒计时"
      maxWidth="md"
      footer={
        <FormButtonGroup align="right">
          <FormButton variant="secondary" onClick={handleClose}>
            取消
          </FormButton>
          <FormButton variant="primary" onClick={handleConfirm} disabled={!isValid}>
            确认
          </FormButton>
        </FormButtonGroup>
      }
    >
      <FormSection title="时间设置">
        <div className={styles.timeInputs}>
          {/* 小时 */}
          <div className={styles.timeInput}>
            <div className={styles.inputGroup}>
              <FormButton
                variant="secondary"
                size="sm"
                className={styles.adjustButton}
                onClick={() => adjustTime("hours", -1)}
                disabled={hours === 0}
                icon={<MinusIcon size={16} />}
                aria-label="减少小时"
              />
              <div className={styles.valueWrapper}>
                <div className={styles.timeValue}>{hours.toString().padStart(2, "0")}</div>
                <span className={styles.unit}>时</span>
              </div>
              <FormButton
                variant="secondary"
                size="sm"
                className={styles.adjustButton}
                onClick={() => adjustTime("hours", 1)}
                disabled={hours === 23}
                icon={<PlusIcon size={16} />}
                aria-label="增加小时"
              />
            </div>
          </div>

          {/* 分钟 */}
          <div className={styles.timeInput}>
            <div className={styles.inputGroup}>
              <FormButton
                variant="secondary"
                size="sm"
                className={styles.adjustButton}
                onClick={() => adjustTime("minutes", -1)}
                disabled={minutes === 0}
                icon={<MinusIcon size={16} />}
                aria-label="减少分钟"
              />
              <div className={styles.valueWrapper}>
                <div className={styles.timeValue}>{minutes.toString().padStart(2, "0")}</div>
                <span className={styles.unit}>分</span>
              </div>
              <FormButton
                variant="secondary"
                size="sm"
                className={styles.adjustButton}
                onClick={() => adjustTime("minutes", 1)}
                disabled={minutes === 59}
                icon={<PlusIcon size={16} />}
                aria-label="增加分钟"
              />
            </div>
          </div>

          {/* 秒 */}
          <div className={styles.timeInput}>
            <div className={styles.inputGroup}>
              <FormButton
                variant="secondary"
                size="sm"
                className={styles.adjustButton}
                onClick={() => adjustTime("seconds", -1)}
                disabled={seconds === 0}
                icon={<MinusIcon size={16} />}
                aria-label="减少秒"
              />
              <div className={styles.valueWrapper}>
                <div className={styles.timeValue}>{seconds.toString().padStart(2, "0")}</div>
                <span className={styles.unit}>秒</span>
              </div>
              <FormButton
                variant="secondary"
                size="sm"
                className={styles.adjustButton}
                onClick={() => adjustTime("seconds", 1)}
                disabled={seconds === 59}
                icon={<PlusIcon size={16} />}
                aria-label="增加秒"
              />
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="快速设置">
        <div className={styles.presetsGrid}>
          {presets.map(({ label, minutes: presetMinutes }) => (
            <FormButton
              key={presetMinutes}
              variant="secondary"
              className={styles.presetButton}
              onClick={() => handlePreset(presetMinutes)}
              title={`设置为${label}`}
            >
              {label}
            </FormButton>
          ))}
        </div>
      </FormSection>
    </Modal>
  );
}
