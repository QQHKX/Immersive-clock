import { contextBridge, ipcRenderer } from 'electron'

// 预加载脚本：仅暴露必要的只读信息到渲染进程（包含中文注释）
// 注意：不暴露 Node API，保持最小可用接口，提升安全性

// 暴露应用信息（版本等）
contextBridge.exposeInMainWorld('appInfo', {
  // 获取应用版本（包含中文注释）
  getVersion: async (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
})

// 预留：可在此扩展只读接口或安全 IPC 封装