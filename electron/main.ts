import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES 模块中获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 禁用硬件加速以提高兼容性（可选）
// app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#000000',
    title: '沉浸式时钟',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  // 开发环境下加载开发服务器，生产环境下加载构建后的文件
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // 生产环境：使用绝对路径加载 index.html
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath);
  }

  // 窗口关闭时的处理
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 快捷键支持
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // F12 或 Ctrl+Shift+I 打开/关闭开发者工具
    if (input.type === 'keyDown') {
      if ((input.key === 'F12') || 
          (input.control && input.shift && input.key === 'I')) {
        if (mainWindow) {
          mainWindow.webContents.toggleDevTools();
        }
        event.preventDefault();
      }
    }
  });

  // 阻止默认的导航行为，增强安全性
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    // 只允许在同一域名下导航
    if (parsedUrl.origin !== process.env.VITE_DEV_SERVER_URL?.replace(/\/$/, '')) {
      event.preventDefault();
    }
  });
}

// 当 Electron 完成初始化时创建窗口
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // macOS 下点击 dock 图标时重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 处理应用退出前的清理工作
app.on('before-quit', () => {
  // 在这里可以添加退出前的清理逻辑
});
