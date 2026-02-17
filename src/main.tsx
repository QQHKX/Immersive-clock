import Clarity from "@microsoft/clarity";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import { AppContextProvider } from "./contexts/AppContext";
import { getAppSettings } from "./utils/appSettings";
import { initErrorCenterGlobalCapture, setErrorCenterMode } from "./utils/errorCenter";
import { initializeStorage } from "./utils/storageInitializer";

import "./styles/global.css";
import "./styles/tour.css";

// 初始化 Microsoft Clarity
if (import.meta.env.PROD) {
  Clarity.init("sfsiwls4dz");
}

// 在应用启动前初始化本地存储
initializeStorage();
setErrorCenterMode(getAppSettings().study.alerts.errorCenterMode);
initErrorCenterGlobalCapture();

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

// 注册 Service Worker（仅在 Web 模式下）
// @ts-ignore
if (__ENABLE_PWA__) {
  import("./pwa-register").then(({ initPWA }) => {
    initPWA();
  });
}
