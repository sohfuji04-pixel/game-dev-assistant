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
  | 'chatgpt'
  | 'blender'
  | 'unity'
  | 'prompt-builder'
  | 'ui-create-ai'
  | 'image-ai'
  | 'vision-ai'
  | 'cursor'
  | 'git'
  | 'assets'
  | 'memory'
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
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  /** 創作ツールハブへ遷移時に自動オープンするツール ID */
  hubPendingToolId: string | null = null;
  /** ハブ内で開いているツール ID（サイドバー強調用） */
  hubActiveToolId: string | null = null;
  /** ハブ一覧へ戻す要求（埋め込みツールを閉じる） */
  hubCloseRequest = false;

  private unsubs: Array<() => void> = [];

  async init(): Promise<void> {
    try {
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
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : String(error);
    }
    this.notify();
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    if (this.flashTimer) clearTimeout(this.flashTimer);
  }

  /** 画面横断の短いステータス表示 */
  flashMessage(message: string, ms = 3200): void {
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.busyMessage = message;
    this.notify();
    this.flashTimer = setTimeout(() => {
      if (this.busyMessage === message) {
        this.busyMessage = '';
        this.notify();
      }
    }, ms);
  }

  setPage(page: AppPage): void {
    this.page = page;
    if (page !== 'hub') {
      this.hubPendingToolId = null;
      this.hubActiveToolId = null;
    }
    this.notify();
  }

  /** 創作ツールハブの一覧（ツールを閉じた状態）へ */
  openHubOverview(): void {
    this.hubPendingToolId = null;
    this.hubActiveToolId = null;
    this.hubCloseRequest = true;
    this.page = 'hub';
    this.notify();
  }

  acknowledgeHubCloseRequest(): void {
    this.hubCloseRequest = false;
  }

  /** AI/3D などから創作ツールを直接開く */
  openCreatorTool(toolId: string): void {
    this.hubCloseRequest = false;
    this.hubPendingToolId = toolId;
    this.page = 'hub';
    this.notify();
  }

  consumeHubPendingToolId(): string | null {
    const id = this.hubPendingToolId;
    this.hubPendingToolId = null;
    return id;
  }

  setHubActiveToolId(toolId: string | null): void {
    if (this.hubActiveToolId === toolId) return;
    this.hubActiveToolId = toolId;
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

  /** 更新エラー表示を閉じる（再確認は設定画面から） */
  clearUpdaterError(): void {
    if (this.updaterStatus.status === 'error') {
      this.updaterStatus = { status: 'idle', message: undefined };
      this.notify();
    }
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
