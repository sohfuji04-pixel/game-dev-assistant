/**
 * Git 操作 ViewModel
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type { GitBranchInfo, GitStatusInfo } from '@shared/types';
import type { AppViewModel } from './AppViewModel';

export class GitViewModel extends ViewModelBase {
  status: GitStatusInfo | null = null;
  branches: GitBranchInfo | null = null;
  commitMessage = '';
  newBranch = '';
  releaseVersion = '';
  message = '';
  loading = false;

  constructor(private readonly app: AppViewModel) {
    super();
  }

  private requireCwd(): string {
    const cwd = this.app.currentProject?.path;
    if (!cwd) throw new Error('先にプロジェクトを開いてください');
    return cwd;
  }

  async refresh(): Promise<void> {
    this.loading = true;
    this.notify();
    try {
      const cwd = this.requireCwd();
      this.status = await ApiClient.gitStatus(cwd);
      if (this.status.isRepo) {
        this.branches = await ApiClient.gitBranches(cwd);
      } else {
        this.branches = null;
      }
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.loading = false;
      this.notify();
    }
  }

  setCommitMessage(value: string): void {
    this.commitMessage = value;
    this.notify();
  }

  setNewBranch(value: string): void {
    this.newBranch = value;
    this.notify();
  }

  setReleaseVersion(value: string): void {
    this.releaseVersion = value;
    this.notify();
  }

  async commit(): Promise<void> {
    try {
      const cwd = this.requireCwd();
      if (!this.commitMessage.trim()) {
        this.message = 'コミットメッセージを入力してください';
        this.notify();
        return;
      }
      const hash = await ApiClient.gitCommit(cwd, this.commitMessage.trim());
      this.message = `Commit 完了: ${hash}`;
      this.commitMessage = '';
      await this.refresh();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
      this.notify();
    }
  }

  async push(): Promise<void> {
    try {
      await ApiClient.gitPush(this.requireCwd());
      this.message = 'Push 完了';
      await this.refresh();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
      this.notify();
    }
  }

  async pull(): Promise<void> {
    try {
      await ApiClient.gitPull(this.requireCwd());
      this.message = 'Pull 完了';
      await this.refresh();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
      this.notify();
    }
  }

  async checkout(branch: string): Promise<void> {
    try {
      await ApiClient.gitCheckout(this.requireCwd(), branch);
      this.message = `Checkout: ${branch}`;
      await this.refresh();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
      this.notify();
    }
  }

  async createBranch(): Promise<void> {
    try {
      if (!this.newBranch.trim()) return;
      await ApiClient.gitCreateBranch(this.requireCwd(), this.newBranch.trim(), true);
      this.message = `Branch 作成: ${this.newBranch}`;
      this.newBranch = '';
      await this.refresh();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
      this.notify();
    }
  }

  async release(): Promise<void> {
    try {
      if (!this.releaseVersion.trim()) return;
      const tag = await ApiClient.gitRelease(this.requireCwd(), this.releaseVersion.trim());
      this.message = `Release: ${tag}`;
      this.releaseVersion = '';
      this.notify();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
      this.notify();
    }
  }
}
