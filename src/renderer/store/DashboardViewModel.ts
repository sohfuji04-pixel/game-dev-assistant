/**
 * ダッシュボード ViewModel
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type { ChangelogEntry, RecentProject, BuildResult } from '@shared/types';
import type { AppViewModel } from './AppViewModel';

export class DashboardViewModel extends ViewModelBase {
  recent: RecentProject[] = [];
  changelog: ChangelogEntry[] = [];
  buildLog = '';
  loading = false;
  message = '';

  constructor(private readonly app: AppViewModel) {
    super();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.notify();
    try {
      this.recent = await ApiClient.listRecentProjects();
      this.changelog = await ApiClient.listChangelog();
    } finally {
      this.loading = false;
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
