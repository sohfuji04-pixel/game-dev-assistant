/**
 * アプリ全体の共有状態 ViewModel
 * 現在のプロジェクト・テーマ・監視イベントなどを保持する。
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type { AppSettings, RecentProject, UpdaterStatus, WatcherEvent } from '@shared/types';

export type AppPage =
  | 'dashboard'
  | 'hub'
  | 'cursor'
  | 'git'
  | 'assets'
  | 'settings'
  | 'logs';

export class AppViewModel extends ViewModelBase {
  page: AppPage = 'dashboard';
  settings: AppSettings | null = null;
  currentProject: RecentProject | null = null;
  watcherEvents: WatcherEvent[] = [];
  updaterStatus: UpdaterStatus = { status: 'idle' };
  version = '';
  busyMessage = '';
  errorMessage = '';

  private unsubs: Array<() => void> = [];

  async init(): Promise<void> {
    this.settings = await ApiClient.getSettings();
    this.version = await ApiClient.getVersion();
    this.updaterStatus = await ApiClient.getUpdaterStatus();

    this.unsubs.push(
      ApiClient.onWatcherEvent((event) => {
        this.watcherEvents = [event, ...this.watcherEvents].slice(0, 50);
        this.notify();
      }),
    );
    this.unsubs.push(
      ApiClient.onUpdaterStatus((status) => {
        this.updaterStatus = status;
        this.notify();
      }),
    );

    this.notify();
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }

  setPage(page: AppPage): void {
    this.page = page;
    this.notify();
  }

  async refreshSettings(): Promise<void> {
    this.settings = await ApiClient.getSettings();
    this.notify();
  }

  async openProject(path?: string): Promise<void> {
    try {
      this.busyMessage = 'プロジェクトを開いています…';
      this.notify();
      const project = await ApiClient.openProject(path);
      if (project) {
        this.currentProject = project;
        await ApiClient.appendLog({
          level: 'info',
          category: 'ui',
          message: `プロジェクト選択: ${project.name}`,
        });
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      this.busyMessage = '';
      this.notify();
    }
  }

  setCurrentProject(project: RecentProject): void {
    this.currentProject = project;
    void ApiClient.startWatcher(project.path);
    this.notify();
  }

  clearError(): void {
    this.errorMessage = '';
    this.notify();
  }
}

/** シングルトン（アプリ全体で共有） */
let appVmSingleton: AppViewModel | null = null;

export function getAppViewModel(): AppViewModel {
  if (!appVmSingleton) {
    appVmSingleton = new AppViewModel();
  }
  return appVmSingleton;
}
