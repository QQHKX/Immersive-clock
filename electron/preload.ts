import { contextBridge, ipcRenderer } from 'electron';

// 声明全局类型（可选，用于 TypeScript）
declare global {
  interface Window {
    electronAPI: {
      platform: string;
    };
  }
}

// 暴露受保护的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 平台信息
  platform: process.platform,
  
  // 可以在这里添加更多需要的 API
  // 例如：文件系统操作、系统通知等
  
  // 示例：发送消息到主进程
  // send: (channel: string, data: any) => {
  //   const validChannels = ['toMain'];
  //   if (validChannels.includes(channel)) {
  //     ipcRenderer.send(channel, data);
  //   }
  // },
  
  // 示例：从主进程接收消息
  // on: (channel: string, callback: Function) => {
  //   const validChannels = ['fromMain'];
  //   if (validChannels.includes(channel)) {
  //     ipcRenderer.on(channel, (event, ...args) => callback(...args));
  //   }
  // },
});
