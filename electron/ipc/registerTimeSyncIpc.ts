import { ipcMain } from "electron";

import { TIME_SYNC_NTP_CHANNEL } from "./channels";
import { queryNtpOnce } from "../ntpService/ntpClient";

export interface TimeSyncNtpRequest {
  host: string;
  port?: number;
  timeoutMs?: number;
}

let registered = false;

/**
 * 注册 NTP 校时 IPC（函数级注释：在主进程提供查询接口，供渲染进程通过 preload 安全调用）
 */
export function registerTimeSyncIpc(): void {
  if (registered) return;
  registered = true;

  ipcMain.handle(TIME_SYNC_NTP_CHANNEL, async (_event, req: TimeSyncNtpRequest) => {
    const host = typeof req?.host === "string" ? req.host : "";
    const port = typeof req?.port === "number" ? req.port : 123;
    const timeoutMs = typeof req?.timeoutMs === "number" ? req.timeoutMs : 8000;

    return await queryNtpOnce({ host, port, timeoutMs });
  });
}
