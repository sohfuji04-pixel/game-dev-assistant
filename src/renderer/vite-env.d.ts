/**
 * レンダラー側の window.electronAPI 型定義
 */
import type { ElectronAPI } from '../shared/types';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
