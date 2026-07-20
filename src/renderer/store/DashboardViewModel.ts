/**
 * ダッシュボード ViewModel
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type {
  ChangelogEntry,
  RecentProject,
  BuildResult,
  ToolConnectionStatus,
} from '@shared/types';
import type { AppViewModel } from './AppViewModel';

export class DashboardViewModel extends ViewModelBase {
  recent: RecentProject[] = [];
  changelog: ChangelogEntry[] = [];
  buildLog = '';
  loading = false;
  checkingConnections = false;
  message = '';
  cursorStatus: ToolConnectionStatus | null = null;
  gitStatus: ToolConnectionStatus | null = null;

  constructor(private readonly app: AppViewModel) {
    super();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.notify();
    try {
      const [recent, changelog] = await Promise.all([
        ApiClient.listRecentProjects(),
        ApiClient.listChangelog(),
      ]);
      this.recent = recent;
      this.changelog = changelog;
      await this.checkConnections();
    } finally {
      this.loading = false;
      this.notify();
    }
  }

  async checkConnections(): Promise<void> {
    this.checkingConnections = true;
    this.notify();
    try {
      const snapshot = await ApiClient.checkToolsConnections();
      this.cursorStatus = snapshot.cursor;
      this.gitStatus = snapshot.git;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.message = `接続確認に失敗: ${message}`;
    } finally {
      this.checkingConnections = false;
      this.notify();
    }
  }

  async openRecent(project: RecentProject): Promise<void> {
    await this.app.openProject(project.path);
    this.app.setCurrentProject(project);
    await this.load();
  }

  async openNew(): Promise<void> {
    await this.app.openProject();
    await this.load();
  }

  async launchCursor(): Promise<void> {
    const folder = this.app.currentProject?.path;
    const result = await ApiClient.launchCursor(folder);
    this.message = result.message;
    this.notify();
  }

  async buildWindows(): Promise<void> {
    await this.runBuild('windows');
  }

  async buildAndroid(): Promise<void> {
    await this.runBuild('android');
  }

  private async runBuild(kind: 'windows' | 'android'): Promise<void> {
    const projectPath = this.app.currentProject?.path;
    if (!projectPath) {
      this.message = '先にプロジェクトを開いてください';
      this.notify();
      return;
    }
    this.loading = true;
    this.message = `${kind} ビルド中…`;
    this.notify();
    try {
      const result: BuildResult =
        kind === 'windows'
          ? await ApiClient.buildWindows(projectPath)
          : await ApiClient.buildAndroid(projectPath);
      this.buildLog = result.log;
      this.message = result.message;
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.loading = false;
      this.notify();
    }
  }
}
