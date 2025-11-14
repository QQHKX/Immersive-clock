import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'

// 创建单例锁，避免多开
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

// 创建主窗口函数（包含中文注释）
function createMainWindow(): void {
  // 创建窗口，禁用 Node 集成，开启上下文隔离以保证安全
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    title: 'Immersive Clock',
    show: true,
  })

  // 根据环境加载页面：开发环境指向 Vite Dev Server，生产环境加载打包后的 index.html
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
  const isDev = process.env.NODE_ENV === 'development'

  if (isDev) {
    // 开发环境：加载本地开发服务器
    win.loadURL(devServerUrl)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    // 生产环境：加载打包产物 dist/index.html
    const indexHtml = path.join(__dirname, '..', '..', 'dist', 'index.html')
    win.loadFile(indexHtml)
  }
}

// 应用就绪时创建窗口（包含中文注释）
app.whenReady().then(() => {
  // 暴露应用版本 IPC（包含中文注释）
  ipcMain.handle('app:getVersion', () => app.getVersion())

  createMainWindow()

  app.on('activate', () => {
    // macOS 上常见行为：无窗口时点击 Dock 图标重新创建
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

// 全部窗口关闭时退出（包含中文注释）
app.on('window-all-closed', () => {
  // Windows/Linux 退出；macOS 习惯保留进程
  if (process.platform !== 'darwin') {
    app.quit()
  }
})