const { contextBridge, ipcRenderer } = require("electron");

const TIME_SYNC_NTP_CHANNEL = "timeSync:ntp";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  timeSync: {
    ntp: (options) => ipcRenderer.invoke(TIME_SYNC_NTP_CHANNEL, options),
  },
});

