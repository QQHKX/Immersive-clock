import { contextBridge, ipcRenderer } from "electron";

import { TIME_SYNC_NTP_CHANNEL } from "./ipc/channels";

// 声明全局类型（可选，用于 TypeScript）
declare global {
  interface Window {
    electronAPI: {
      platform: string;
      timeSync: {
        ntp: (options: { host: string; port?: number; timeoutMs?: number }) => Promise<{
          offsetMs: number;
          rttMs: number;
          serverEpochMs: number;
          measuredAt: number;
        }>;
      };
    };
  }
}

// 暴露受保护的 API 给渲染进程
contextBridge.exposeInMainWorld("electronAPI", {
  // 平台信息
  platform: process.platform,

  timeSync: {
    /**
     * 发起一次 NTP 校时（函数级注释：通过 IPC 调用主进程的 UDP/NTP 查询能力，返回 offset 与 rtt）
     */
    ntp: (options: { host: string; port?: number; timeoutMs?: number }) =>
      ipcRenderer.invoke(TIME_SYNC_NTP_CHANNEL, options),
  },

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
