import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ClockPage } from './pages/ClockPage/ClockPage';

import styles from './App.module.css';

/**
 * 主应用组件
 * 设置路由并渲染主要的时钟页面
 */
export function App() {


  return (
    <div className={styles.app}>
      <Routes>
        <Route path="/" element={<ClockPage />} />
        <Route path="*" element={<ClockPage />} />
      </Routes>
    </div>
  );
}