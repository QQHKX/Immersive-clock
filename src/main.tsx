import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// PWA Service Worker 注册（自动更新与离线支持）
import { registerSW } from "virtual:pwa-register";

import { App } from "./App";
import { AppContextProvider } from "./contexts/AppContext";

import "./styles/global.css";

/**
 * 应用程序入口点
 * 设置React根节点，包装应用程序的提供者和路由
 */
const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

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
  const loadingScreen = document.getElementById("loading-screen");
  if (loadingScreen) {
    // 确保DOM完全渲染后再隐藏加载动画
    requestAnimationFrame(() => {
      loadingScreen.remove();
    });
  }
}, 200);

// 注册 Service Worker（生产与开发均启用，devOptions.enabled 已在 VitePWA 中设置）
if ("serviceWorker" in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {},
    onOfflineReady() {},
  });
}
