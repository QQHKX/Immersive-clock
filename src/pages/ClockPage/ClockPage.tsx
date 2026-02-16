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
import type { MessagePopupOpenDetail, MessagePopupType } from "../../types/messagePopup";
import { startTimeSyncManager } from "../../utils/timeSync";
import { startTour, isTourActive } from "../../utils/tour";

import styles from "./ClockPage.module.css";

const MINUTELY_PRECIP_POPUP_ID = "weather:minutelyPrecip";
const MINUTELY_PRECIP_POPUP_OPEN_KEY = "weather.minutely.popupOpen";
const MINUTELY_PRECIP_POPUP_DISMISSED_KEY = "weather.minutely.popupDismissed";

/**
 * 时钟主页面组件
 * 根据当前模式显示相应的时钟组件，处理HUD显示逻辑
 */
export function ClockPage() {
  const { mode, isModalOpen, study } = useAppState();
  const dispatch = useAppDispatch();
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hudContainerRef = useRef<HTMLDivElement | null>(null);
  const prevModeRef = useRef(mode);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [globalPopups, setGlobalPopups] = useState<
    Array<{
      id: string;
      type: MessagePopupType;
      title: string;
      message: React.ReactNode;
      themeColor?: string;
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
   * 清除 HUD 自动隐藏定时器
   */
  const clearHudHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  /**
   * 判断是否应阻止 HUD 被自动隐藏（例如：键盘焦点在 HUD 内或引导中）
   */
  const shouldPreventHudAutoHide = useCallback(() => {
    if (isTourActive()) return true;
    const activeElement = document.activeElement;
    if (!activeElement) return false;
    return !!hudContainerRef.current?.contains(activeElement);
  }, []);

  /**
   * 启动 HUD 自动隐藏定时器
   */
  const scheduleHudAutoHide = useCallback(() => {
    clearHudHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      if (shouldPreventHudAutoHide()) {
        scheduleHudAutoHide();
        return;
      }
      dispatch({ type: "HIDE_HUD" });
      hideTimeoutRef.current = null;
    }, 8000);
  }, [clearHudHideTimeout, dispatch, shouldPreventHudAutoHide]);

  useEffect(() => {
    return () => {
      clearHudHideTimeout();
    };
  }, [clearHudHideTimeout]);

  // 自动启动新手指引
  useEffect(() => {
    const timer = setTimeout(() => {
      startTour(false, {
        onStart: () => {
          // 确保 HUD 显示并清除自动隐藏定时器
          dispatch({ type: "SHOW_HUD" });
          clearHudHideTimeout();
        },
        switchMode: (mode) => {
          dispatch({ type: "SET_MODE", payload: mode as any });
        },
        openSettings: () => {
          setShowSettings(true);
        },
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [dispatch]);

  /**
   * 处理页面点击事件
   * 显示HUD并设置自动隐藏定时器
   */
  const handlePageClick = useCallback(
    (e?: React.MouseEvent) => {
      // 如果模态框打开，不处理点击事件
      if (isModalOpen) {
        return;
      }

      // 显示HUD
      dispatch({ type: "SHOW_HUD" });

      const eventTarget = (e?.target as Element | null) ?? null;
      const isClickInsideHud =
        !!eventTarget && !!hudContainerRef.current?.contains(eventTarget as Node);

      if (isClickInsideHud) {
        clearHudHideTimeout();
        return;
      }

      scheduleHudAutoHide();
    },
    [clearHudHideTimeout, dispatch, isModalOpen, scheduleHudAutoHide]
  );

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
      if (eventTarget && hudContainerRef.current?.contains(eventTarget)) {
        return;
      }
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

  // 全局消息弹窗事件监听：自习模式下全量响应，非自习模式仅响应天气相关弹窗
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<MessagePopupOpenDetail>).detail || {};
      const type: MessagePopupType = detail.type ?? "general";
      if (mode !== "study" && type !== "weatherForecast" && type !== "weatherAlert") return;
      if (type === "error" && !study.errorPopupEnabled) return;
      const title = (detail.title as string) || "消息提醒";
      const message = (detail.message as React.ReactNode) || "";
      const themeColor = typeof detail.themeColor === "string" ? detail.themeColor : undefined;
      const id = (detail.id as string) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setGlobalPopups((prev) => {
        const idx = prev.findIndex((x) => x.id === id);
        const nextItem = { id, type, title, message, themeColor };
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
          /* 忽略错误 */
        }
      }
    };
    const onClose = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const id = typeof detail.id === "string" ? detail.id : "";
      const dismiss = detail.dismiss === true;

      if (id) {
        setGlobalPopups((prev) => prev.filter((x) => x.id !== id));
      } else {
        setGlobalPopups([]);
      }

      if (!id || id === MINUTELY_PRECIP_POPUP_ID) {
        try {
          sessionStorage.setItem(MINUTELY_PRECIP_POPUP_OPEN_KEY, "0");
          if (dismiss) {
            sessionStorage.setItem(MINUTELY_PRECIP_POPUP_DISMISSED_KEY, "1");
          }
        } catch {
          /* 忽略错误 */
        }
      }
    };
    window.addEventListener("messagePopup:open", onOpen as EventListener);
    window.addEventListener("messagePopup:close", onClose as EventListener);
    return () => {
      window.removeEventListener("messagePopup:open", onOpen as EventListener);
      window.removeEventListener("messagePopup:close", onClose as EventListener);
    };
  }, [mode, study.errorPopupEnabled]);

  // 非自习模式下仅保留天气相关弹窗，避免其它业务弹窗打扰
  useEffect(() => {
    if (mode === "study") return;
    setGlobalPopups((prev) =>
      prev.filter((p) => p.type === "weatherForecast" || p.type === "weatherAlert")
    );
  }, [mode, globalPopups.length]);

  return (
    <main
      className={styles.clockPage}
      onClick={handlePageClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label="时钟应用主界面"
    >
      <div
        className={styles.timeDisplay}
        id={`${mode}-panel`}
        role="tabpanel"
        data-tour="clock-area"
      >
        {renderTimeDisplay()}
      </div>

      <div
        ref={hudContainerRef}
        onFocusCapture={() => {
          dispatch({ type: "SHOW_HUD" });
          clearHudHideTimeout();
        }}
        onBlurCapture={(e) => {
          const nextFocused = e.relatedTarget as Node | null;
          if (nextFocused && hudContainerRef.current?.contains(nextFocused)) {
            return;
          }
          if (isModalOpen) return;
          scheduleHudAutoHide();
        }}
        onPointerDownCapture={() => {
          dispatch({ type: "SHOW_HUD" });
          clearHudHideTimeout();
        }}
      >
        <HUD />
      </div>

      <AuthorInfo onVersionClick={handleVersionClick} />

      {/* 仅在时钟页面显示的左下角指引按钮 */}
      {mode === "clock" && (
        <button
          className={styles.tourButton}
          onClick={() => {
            startTour(true, {
              onStart: () => {
                dispatch({ type: "SHOW_HUD" });
              },
            });
          }}
          title="重播新手指引"
          type="button"
          aria-label="重播新手指引"
        >
          ?
        </button>
      )}

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
      {globalPopups.length > 0 && (
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
                    /* 忽略错误 */
                  }
                }
                setGlobalPopups((prev) => prev.filter((x) => x.id !== p.id));
              }}
              type={p.type}
              title={p.title}
              message={p.message}
              themeColor={p.themeColor}
              usePortal={false}
            />
          ))}
        </div>
      )}
    </main>
  );
}
