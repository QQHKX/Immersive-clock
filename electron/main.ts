import { app, BrowserWindow, protocol, session, systemPreferences } from "electron";
import fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import { registerTimeSyncIpc } from "./ipc/registerTimeSyncIpc";

// ES 模块中获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function mergeChromiumFeatureSwitch(
  switchName: "enable-features" | "disable-features",
  add: string
) {
  const current = app.commandLine.getSwitchValue(switchName);
  const next = current ? `${current},${add}` : add;
  app.commandLine.appendSwitch(switchName, next);
}

if (process.platform === "win32") {
  mergeChromiumFeatureSwitch(
    "enable-features",
    "LocationProviderManager:LocationProviderManagerMode/PlatformOnly"
  );
  mergeChromiumFeatureSwitch("enable-features", "WinrtGeolocationImplementation");
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

// 禁用硬件加速以提高兼容性（可选）
// app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;

/**
 * 解析 preload 脚本路径（函数级注释：兼容不同构建环境输出的 preload 扩展名，避免加载到旧产物或加载失败）
 */
function resolvePreloadPath(): string {
  if (process.env.VITE_DEV_SERVER_URL) {
    const devPreload = path.resolve(process.cwd(), "electron", "preload.dev.cjs");
    if (fs.existsSync(devPreload) && fs.statSync(devPreload).isFile()) return devPreload;
  }

  const candidates = ["preload.cjs", "preload.js", "preload.mjs"];
  for (const name of candidates) {
    const direct = path.join(__dirname, name);
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;

    const fromCwd = path.resolve(process.cwd(), "dist-electron", name);
    if (fs.existsSync(fromCwd) && fs.statSync(fromCwd).isFile()) return fromCwd;
  }
  return path.join(__dirname, "preload.js");
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".mp3": "audio/mpeg",
  };
  return map[ext] || "application/octet-stream";
}

function createFileResponse(filePath: string): Response {
  const data = fs.readFileSync(filePath);
  return new Response(data, {
    status: 200,
    headers: {
      "content-type": getMimeType(filePath),
    },
  });
}

async function registerAppProtocol() {
  const distDir = path.join(__dirname, "../dist");
  await protocol.handle("app", async (request) => {
    try {
      const url = new URL(request.url);
      let pathname = decodeURIComponent(url.pathname || "/");
      if (pathname === "/") pathname = "/index.html";

      let resolvedPath = path.normalize(path.join(distDir, pathname));
      if (!resolvedPath.startsWith(distDir)) {
        return new Response("Bad Request", { status: 400 });
      }

      const hasExt = Boolean(path.extname(resolvedPath));
      const exists = fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile();

      if (!exists) {
        if (!hasExt) {
          resolvedPath = path.join(distDir, "index.html");
          if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
            return createFileResponse(resolvedPath);
          }
        }
        return new Response("Not Found", { status: 404 });
      }

      return createFileResponse(resolvedPath);
    } catch {
      return new Response("Internal Server Error", { status: 500 });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#000000",
    title: "沉浸式时钟",
    autoHideMenuBar: true,
    webPreferences: {
      preload: resolvePreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  // 开发环境下加载开发服务器，生产环境下加载构建后的文件
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadURL("app://local/index.html");
  }

  // 窗口关闭时的处理
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // 快捷键支持
  mainWindow.webContents.on("before-input-event", (event, input) => {
    // F12 或 Ctrl+Shift+I 打开/关闭开发者工具
    if (input.type === "keyDown") {
      if (input.key === "F12" || (input.control && input.shift && input.key === "I")) {
        if (mainWindow) {
          mainWindow.webContents.toggleDevTools();
        }
        event.preventDefault();
      }
    }
  });

  // 阻止默认的导航行为，增强安全性
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const parsedUrl = new URL(url);
    if (process.env.VITE_DEV_SERVER_URL) {
      const allowedOrigin = new URL(process.env.VITE_DEV_SERVER_URL).origin;
      if (parsedUrl.origin !== allowedOrigin) {
        event.preventDefault();
      }
      return;
    }
    if (parsedUrl.protocol !== "app:") {
      event.preventDefault();
    }
  });
}

// 当 Electron 完成初始化时创建窗口
app.whenReady().then(async () => {
  await registerAppProtocol();
  registerTimeSyncIpc();

  /**
   * 判断是否为“仅音频采集”的 media 权限请求（拒绝视频，以避免意外放行摄像头/屏幕录制）
   */
  const isAudioOnlyMediaRequest = (details: unknown): boolean => {
    const mediaTypes = (details as { mediaTypes?: string[] } | null)?.mediaTypes;
    if (!Array.isArray(mediaTypes) || mediaTypes.length === 0) {
      return true;
    }
    const wantsAudio = mediaTypes.includes("audio");
    const wantsVideo = mediaTypes.includes("video");
    return wantsAudio && !wantsVideo;
  };

  /**
   * Electron 权限策略：
   * - 地理位置与“仅音频采集”允许；
   * - 其他权限默认拒绝（更安全）。
   */
  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin, details) => {
      if (permission === "geolocation") return true;
      if (permission === "media") return isAudioOnlyMediaRequest(details);
      return false;
    }
  );

  session.defaultSession.setPermissionRequestHandler(
    async (webContents, permission, callback, details) => {
      if (permission === "geolocation") {
        callback(true);
        return;
      }

      if (permission === "media") {
        if (!isAudioOnlyMediaRequest(details)) {
          callback(false);
          return;
        }

        if (process.platform === "darwin") {
          try {
            const granted = await systemPreferences.askForMediaAccess("microphone");
            callback(Boolean(granted));
          } catch {
            callback(false);
          }
          return;
        }

        callback(true);
        return;
      }

      callback(false);
    }
  );

  createWindow();

  app.on("activate", () => {
    // macOS 下点击 dock 图标时重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用（macOS 除外）
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// 处理应用退出前的清理工作
app.on("before-quit", () => {
  // 在这里可以添加退出前的清理逻辑
});
