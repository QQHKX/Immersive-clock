// PWA Service Worker 注册
import { registerSW } from "virtual:pwa-register";

/**
 * 初始化 PWA Service Worker 注册
 */
export function initPWA() {
  if ("serviceWorker" in navigator) {
    registerSW({
      immediate: true,
      onNeedRefresh() {},
      onOfflineReady() {},
    });
  }
}
