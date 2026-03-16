import React, { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";

import styles from "./App.module.css";
import AnnouncementModal from "./components/AnnouncementModal";
import { Confetti } from "./components/Confetti/Confetti";
import { ClockPage } from "./pages/ClockPage/ClockPage";
import { shouldShowAnnouncement } from "./utils/announcementStorage";
import { hasSeenTour } from "./utils/tour";

/**
 * 主应用组件
 * 设置路由并渲染主要的时钟页面
 * 包含首次访问时的进入动画和公告弹窗
 */
export function App() {
  const [showEnterAnimation, setShowEnterAnimation] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showTourConfetti, setShowTourConfetti] = useState(false);

  /**
   * 设置进入动画和公告弹窗
   * 在组件首次挂载时触发
   */
  useEffect(() => {
    // 直接触发进入动画
    setShowEnterAnimation(true);

    // 动画完成后隐藏
    const timer = setTimeout(() => {
      setShowEnterAnimation(false);
    }, 1000); // 1秒动画时长

    // 检查是否需要显示公告
    const checkAnnouncement = () => {
      if (shouldShowAnnouncement()) {
        // 如果用户未看过指引，则等待指引结束
        if (!hasSeenTour()) {
          const onTourEnd = () => {
            setShowAnnouncement(true);
            window.removeEventListener("tour:end", onTourEnd);
          };
          window.addEventListener("tour:end", onTourEnd);
          return;
        }

        // 延迟显示公告，等待进入动画完成
        setTimeout(() => {
          setShowAnnouncement(true);
        }, 1200); // 在进入动画完成后200ms显示
      }
    };

    checkAnnouncement();

    // 监听指引开始事件，强制关闭公告
    const onTourStart = () => {
      setShowAnnouncement(false);
    };
    window.addEventListener("tour:start", onTourStart);

    const onTourCompleted = () => {
      setShowTourConfetti(true);
      setTimeout(() => {
        setShowTourConfetti(false);
      }, 2600);
    };
    window.addEventListener("tour:completed", onTourCompleted);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("tour:start", onTourStart);
      window.removeEventListener("tour:completed", onTourCompleted);
    };
  }, []); // 空依赖数组确保只在组件挂载时执行一次

  return (
    <div className={`${styles.app} ${showEnterAnimation ? styles.enterAnimation : ""}`}>
      <Routes>
        <Route path="/" element={<ClockPage />} />
        <Route path="*" element={<ClockPage />} />
      </Routes>

      {showTourConfetti && <Confetti />}

      {/* 公告弹窗 */}
      <AnnouncementModal
        isOpen={showAnnouncement}
        onClose={() => setShowAnnouncement(false)}
        initialTab="announcement"
      />
    </div>
  );
}
