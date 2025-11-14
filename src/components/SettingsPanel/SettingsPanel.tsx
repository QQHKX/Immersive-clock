import React, { useState, useCallback, useEffect, useRef } from "react";

import { useAppState, useAppDispatch } from "../../contexts/AppContext";
import { logger } from "../../utils/logger";
import { broadcastSettingsEvent, SETTINGS_EVENTS } from "../../utils/settingsEvents";
import { FormButton, FormButtonGroup } from "../FormComponents";
import { Modal } from "../Modal";
import modalStyles from "../Modal/Modal.module.css";
import { Tabs } from "../Tabs/Tabs";

import AboutSettingsPanel from "./sections/AboutSettingsPanel";
import BasicSettingsPanel from "./sections/BasicSettingsPanel";
import ContentSettingsPanel from "./sections/ContentSettingsPanel";
import MessagePopupSettingsPanel from "./sections/MessagePopupSettingsPanel";
import StudySettingsPanel from "./sections/StudySettingsPanel";
import WeatherSettingsPanel from "./sections/WeatherSettingsPanel";
import styles from "./SettingsPanel.module.css";

/**
 * 设置面板属性
 * - `isOpen`：是否显示设置面板
 * - `onClose`：关闭面板的回调
 */
interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 设置面板主组件
 * 将基础、天气、监测、金句、关于分区委托给子组件，
 * 保留目标年份持久化与选项卡切换逻辑。
 */
export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { study } = useAppState();
  const dispatch = useAppDispatch();

  const [activeCategory, setActiveCategory] = useState<
    "basic" | "weather" | "monitor" | "quotes" | "messages" | "about"
  >("basic");
  const [targetYear, setTargetYear] = useState(study.targetYear);
  // 分区保存注册
  const basicSaveRef = useRef<() => void>(() => {});
  const weatherSaveRef = useRef<() => void>(() => {});
  const monitorSaveRef = useRef<() => void>(() => {});
  const quotesSaveRef = useRef<() => void>(() => {});
  const messagesSaveRef = useRef<() => void>(() => {});
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * 统一关闭处理：广播面板关闭事件
   */
  const handleClose = useCallback(() => {
    try {
      broadcastSettingsEvent(SETTINGS_EVENTS.SettingsPanelClosed);
    } finally {
      onClose();
    }
  }, [onClose]);

  /** 保存所有设置 */
  const handleSaveAll = useCallback(() => {
    // 目标年份持久化（基础设置中会调整，但此处统一写入）
    dispatch({ type: "SET_TARGET_YEAR", payload: targetYear });
    try {
      basicSaveRef.current?.();
      weatherSaveRef.current?.();
      monitorSaveRef.current?.();
      quotesSaveRef.current?.();
      messagesSaveRef.current?.();
    } catch (e) {
      logger.error("保存分区设置失败:", e);
      alert("保存设置时出现错误，请重试");
      return;
    }
    // 广播：保存完成事件（包含关键摘要）
    broadcastSettingsEvent(SETTINGS_EVENTS.SettingsSaved, { targetYear });
    handleClose();
  }, [targetYear, dispatch, handleClose]);

  // 打开时默认分区与数据
  useEffect(() => {
    if (isOpen) {
      setTargetYear(study.targetYear);
      setActiveCategory("basic");
    }
  }, [isOpen, study.targetYear]);

  // 切换分区时滚动到顶部
  useEffect(() => {
    if (!isOpen) return;
    const bodyEl = containerRef.current?.closest(`.${modalStyles.modalBody}`) as HTMLElement | null;
    if (bodyEl) bodyEl.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeCategory, isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="设置"
        maxWidth="lg"
        headerDivider={false}
        compactBodyTop
        footer={
          <FormButtonGroup align="right">
            <FormButton variant="secondary" onClick={handleClose}>
              取消
            </FormButton>
            <FormButton variant="primary" onClick={handleSaveAll}>
              保存
            </FormButton>
          </FormButtonGroup>
        }
      >
        <div ref={containerRef} className={styles.settingsContainer}>
          {/* 顶部分类选项卡 */}
          <Tabs
            items={[
              { key: "basic", label: "基础设置" },
              { key: "weather", label: "天气设置" },
              { key: "monitor", label: "监测设置" },
              { key: "quotes", label: "金句设置" },
              { key: "messages", label: "消息弹窗" },
              { key: "about", label: "关于" },
            ]}
            activeKey={activeCategory}
            onChange={(key) =>
              setActiveCategory(
                key as "basic" | "weather" | "monitor" | "quotes" | "messages" | "about"
              )
            }
            variant="announcement"
            size="md"
            scrollable
            sticky
          />

          {/* 基础设置 */}
          {activeCategory === "basic" && (
            <BasicSettingsPanel
              targetYear={targetYear}
              onTargetYearChange={setTargetYear}
              onRegisterSave={(fn) => {
                basicSaveRef.current = fn;
              }}
            />
          )}

          {/* 天气设置 */}
          {activeCategory === "weather" && (
            <WeatherSettingsPanel
              onRegisterSave={(fn) => {
                weatherSaveRef.current = fn;
              }}
            />
          )}

          {/* 监测设置（噪音相关） */}
          {activeCategory === "monitor" && (
            <StudySettingsPanel
              onRegisterSave={(fn) => {
                monitorSaveRef.current = fn;
              }}
            />
          )}

          {/* 金句设置 */}
          {activeCategory === "quotes" && (
            <ContentSettingsPanel
              onRegisterSave={(fn) => {
                quotesSaveRef.current = fn;
              }}
            />
          )}

          {/* 消息弹窗设置 */}
          {activeCategory === "messages" && (
            <MessagePopupSettingsPanel
              onRegisterSave={(fn) => {
                messagesSaveRef.current = fn;
              }}
            />
          )}

          {/* 关于 */}
          {activeCategory === "about" && (
            <AboutSettingsPanel
              onRegisterSave={() => {
                /* noop */
              }}
            />
          )}
        </div>
      </Modal>
    </>
  );
}
