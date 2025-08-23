import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ClockPage } from './pages/ClockPage/ClockPage';

import styles from './App.module.css';

/**
 * 主应用组件
 * 设置路由并渲染主要的时钟页面
 * 包含首次访问时的进入动画
 */
export function App() {
  const [showEnterAnimation, setShowEnterAnimation] = useState(false);

  /**
   * 设置进入动画
   * 在组件首次挂载时触发，使用优化的动画避免布局重排
   */
  useEffect(() => {
    // 直接触发进入动画
    setShowEnterAnimation(true);
    
    // 动画完成后隐藏，清理will-change属性以优化性能
    const timer = setTimeout(() => {
      setShowEnterAnimation(false);
    }, 1000); // 1秒动画时长
    
    return () => clearTimeout(timer);
  }, []); // 空依赖数组确保只在组件挂载时执行一次

  return (
    <div className={`${styles.app} ${showEnterAnimation ? styles.enterAnimation : ''}`}>
      <Routes>
        <Route path="/" element={<ClockPage />} />
        <Route path="*" element={<ClockPage />} />
      </Routes>
    </div>
  );
}