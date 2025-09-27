import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppContextProvider } from './contexts/AppContext';
import { App } from './App';
import './styles/global.css';

/**
 * 应用程序入口点
 * 设置React根节点，包装应用程序的提供者和路由
 */
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AppContextProvider>
        <App />
      </AppContextProvider>
    </BrowserRouter>
  </React.StrictMode>
);

/**
 * 隐藏加载动画
 * 在React应用渲染完成后执行
 */
setTimeout(() => {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    // 确保DOM完全渲染后再隐藏加载动画
    requestAnimationFrame(() => {
      loadingScreen.remove();
    });
  }
}, 200);