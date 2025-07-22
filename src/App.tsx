import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ClockPage } from './pages/ClockPage/ClockPage';
import { trackEvent } from './utils/clarity';
import styles from './App.module.css';

/**
 * 主应用组件
 * 设置路由并渲染主要的时钟页面
 */
export function App() {
  // 应用加载时记录事件
  useEffect(() => {
    // 记录应用初始化事件
    trackEvent('app_initialized', { timestamp: new Date().toISOString() });
  }, []);

  return (
    <div className={styles.app}>
      <Routes>
        <Route path="/" element={<ClockPage />} />
        <Route path="*" element={<ClockPage />} />
      </Routes>
    </div>
  );
}