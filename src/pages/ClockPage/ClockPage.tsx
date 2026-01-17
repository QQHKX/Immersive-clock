import React, { useCallback, useRef, useEffect, useState } from "react";

import AnnouncementModal from "../../components/AnnouncementModal";
import { AuthorInfo } from "../../components/AuthorInfo/AuthorInfo";
import { Clock } from "../../components/Clock/Clock";
import { Countdown } from "../../components/Countdown/Countdown";
import { CountdownModal } from "../../components/CountdownModal/CountdownModal";
import { HUD } from "../../components/HUD/HUD";
import MessagePopup from "../../components/MessagePopup/MessagePopup";
import { SettingsButton } from "../../components/SettingsButton";
import { SettingsPanel } from "../../components/SettingsPanel";
import { Stopwatch } from "../../components/Stopwatch/Stopwatch";
import { Study } from "../../components/Study/Study";
import { useAppState, useAppDispatch } from "../../contexts/AppContext";
import { startTimeSyncManager } from "../../utils/timeSync";

import styles from "./ClockPage.module.css";

const MINUTELY_PRECIP_POPUP_ID = "weather:minutelyPrecip";
const MINUTELY_PRECIP_POPUP_OPEN_KEY = "weather.minutely.popupOpen";
const MINUTELY_PRECIP_POPUP_DISMISSED_KEY = "weather.minutely.popupDismissed";

/**
 * 时钟主页面组件
 * 根据当前模式显示相应的时钟组件，处理HUD显示逻辑
 */
export function ClockPage() {
  const { mode, isModalOpen } = useAppState();
  const dispatch = useAppDispatch();
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevModeRef = useRef(mode);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [globalPopups, setGlobalPopups] = useState<
    Array<{
      id: string;
      type: "general" | "weatherAlert" | "coolingReminder" | "systemUpdate";
      title: string;
      message: React.ReactNode;
    }>
  >([]);

  // 跟踪模式变化
  useEffect(() => {
    if (prevModeRef.current !== "study" && mode === "study") {
      const ev = new CustomEvent("weatherMinutelyPrecipRefresh", {
        detail: { forceApi: false, openIfRain: true },
      });
      window.dispatchEvent(ev);
    }
    prevModeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    return startTimeSyncManager();
  }, []);

  /**
   * 处理页面点击事件
   * 显示HUD并设置自动隐藏定时器
   */
  const handlePageClick = useCallback(() => {
    // 如果模态框打开，不处理点击事件
    if (isModalOpen) {
      return;
    }

    // 显示HUD
    dispatch({ type: "SHOW_HUD" });

    // 清除之前的定时器
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // 设置8秒后自动隐藏HUD
    hideTimeoutRef.current = setTimeout(() => {
      dispatch({ type: "HIDE_HUD" });
      hideTimeoutRef.current = null;
    }, 8000);
  }, [dispatch, isModalOpen]);

  /**
   * 处理键盘事件
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      /**
       * 如果倒计时模态框或设置面板打开，则不处理页面级键盘事件
       * 避免拦截输入组件的回车（如 textarea 换行）
       */
      // 注意：SettingsPanel 通过 Portal 渲染，事件仍会沿 React 树冒泡到此处
      if (isModalOpen || showSettings) {
        return;
      }

      /**
       * 在表单输入或可编辑元素中，不拦截回车或空格
       * 保证输入框/文本域/可编辑区域的默认行为（换行、输入等）
       */
      const eventTarget = e.target as HTMLElement | null;
      const tagName = eventTarget?.tagName?.toUpperCase();
      const isEditingElement =
        !!eventTarget &&
        (tagName === "INPUT" || tagName === "TEXTAREA" || eventTarget.isContentEditable === true);
      if (isEditingElement) {
        return;
      }

      // 空格键或回车键显示HUD（仅当不在输入环境中）
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        handlePageClick();
      }
    },
    [handlePageClick, isModalOpen, showSettings]
  );

  /**
   * 处理设置按钮点击
   */
  const handleSettingsClick = useCallback(() => {
    setShowSettings(true);
  }, []);

  /**
   * 处理设置面板关闭
   */
  const handleSettingsClose = useCallback(() => {
    setShowSettings(false);
  }, []);

  /**
   * 处理版本号点击，显示公告弹窗
   */
  const handleVersionClick = useCallback(() => {
    setShowAnnouncement(true);
  }, []);

  /**
   * 处理公告弹窗关闭
   */
  const handleAnnouncementClose = useCallback(() => {
    setShowAnnouncement(false);
  }, []);

  /**
   * 渲染当前模式的时钟组件
   */
  const renderTimeDisplay = () => {
    switch (mode) {
      case "clock":
        return <Clock />;
      case "countdown":
        return <Countdown />;
      case "stopwatch":
        return <Stopwatch />;
      case "study":
        return <Study />;
      default:
        return <Clock />;
    }
  };

  // 全局消息弹窗事件监听：仅在自习模式下响应（堆叠显示）
  useEffect(() => {
    const onOpen = (e: Event) => {
      if (mode !== "study") return;
      const detail = (e as CustomEvent).detail || {};
      const type =
        (detail.type as "general" | "weatherAlert" | "coolingReminder" | "systemUpdate") ||
        "general";
      const title = (detail.title as string) || "消息提醒";
      const message = (detail.message as React.ReactNode) || "";
      const id = (detail.id as string) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setGlobalPopups((prev) => {
        const idx = prev.findIndex((x) => x.id === id);
        const nextItem = { id, type, title, message };
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = nextItem;
          return next;
        }
        return [...prev, nextItem];
      });
      if (id === MINUTELY_PRECIP_POPUP_ID) {
        try {
          sessionStorage.setItem(MINUTELY_PRECIP_POPUP_OPEN_KEY, "1");
        } catch {
          /* ignore */
        }
      }
    };
    const onClose = () => {
      setGlobalPopups([]);
      try {
        sessionStorage.setItem(MINUTELY_PRECIP_POPUP_OPEN_KEY, "0");
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("messagePopup:open", onOpen as EventListener);
    window.addEventListener("messagePopup:close", onClose as EventListener);
    return () => {
      window.removeEventListener("messagePopup:open", onOpen as EventListener);
      window.removeEventListener("messagePopup:close", onClose as EventListener);
    };
  }, [mode]);

  // 模式切换到非自习时自动关闭全局弹窗
  useEffect(() => {
    if (mode !== "study" && globalPopups.length > 0) {
      setGlobalPopups([]);
      try {
        sessionStorage.setItem(MINUTELY_PRECIP_POPUP_OPEN_KEY, "0");
      } catch {
        /* ignore */
      }
    }
  }, [mode, globalPopups.length]);

  return (
    <div
      className={styles.clockPage}
      onClick={handlePageClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="main"
      aria-label="时钟应用主界面"
    >
      <div className={styles.timeDisplay} id={`${mode}-panel`} role="tabpanel">
        {renderTimeDisplay()}
      </div>

      <HUD />

      <AuthorInfo onVersionClick={handleVersionClick} />

      {/* 设置按钮 - 只在自习模式下显示 */}
      {mode === "study" && (
        <SettingsButton onClick={handleSettingsClick} isVisible={!isModalOpen && !showSettings} />
      )}

      {/* 设置面板 */}
      <SettingsPanel isOpen={showSettings} onClose={handleSettingsClose} />

      {isModalOpen && <CountdownModal />}

      {/* 公告弹窗 */}
      <AnnouncementModal
        isOpen={showAnnouncement}
        onClose={handleAnnouncementClose}
        initialTab="announcement"
      />

      {/* 全局消息弹窗堆叠容器：通过事件触发，不受设置面板卸载影响 */}
      {mode === "study" && globalPopups.length > 0 && (
        <div
          style={{
            position: "fixed",
            left: 8,
            bottom: 80,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            zIndex: 1201,
          }}
          aria-live="polite"
          aria-label="消息弹窗堆叠容器"
        >
          {globalPopups.map((p) => (
            <MessagePopup
              key={p.id}
              isOpen={true}
              onClose={() => {
                if (p.id === MINUTELY_PRECIP_POPUP_ID) {
                  try {
                    sessionStorage.setItem(MINUTELY_PRECIP_POPUP_OPEN_KEY, "0");
                    sessionStorage.setItem(MINUTELY_PRECIP_POPUP_DISMISSED_KEY, "1");
                  } catch {
                    /* ignore */
                  }
                }
                setGlobalPopups((prev) => prev.filter((x) => x.id !== p.id));
              }}
              type={p.type}
              title={p.title}
              message={p.message}
              usePortal={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
