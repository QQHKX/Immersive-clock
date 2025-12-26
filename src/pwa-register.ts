// PWA Service Worker 注册
import { registerSW } from "virtual:pwa-register";

export function initPWA() {
  if ("serviceWorker" in navigator) {
    registerSW({
      immediate: true,
      onNeedRefresh() {},
      onOfflineReady() {},
    });
  }
}
