/**
 * Preload スクリプト
 * contextBridge 経由でレンダラーへ安全な API のみ公開する。
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../shared/types';

const api: ElectronAPI = {
  invoke(channel, ...args) {
    return ipcRenderer.invoke(channel, ...args);
  },
  on(channel, listener) {
    const subscription = (_event: Electron.IpcRendererEvent, ...payload: unknown[]) => {
      listener(...payload);
    };
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
