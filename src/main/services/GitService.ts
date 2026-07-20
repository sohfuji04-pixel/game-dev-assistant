/**
 * Git 操作サービス（simple-git）
 * Commit / Push / Pull / Branch / Release を提供する。
 */
import { simpleGit, type SimpleGit } from 'simple-git';
import type { GitBranchInfo, GitStatusInfo, ToolConnectionStatus } from '../../shared/types';
import type { LogService } from './LogService';
import type { SettingsService } from './SettingsService';

export class GitService {
  constructor(
    private readonly settings: SettingsService,
    private readonly log: LogService,
  ) {}

  private client(cwd: string): SimpleGit {
    const gitPath = this.settings.get().gitPath || 'git';
    return simpleGit({ baseDir: cwd, binary: gitPath });
  }

  /** git バイナリの接続・バージョンを確認する（cwd 不要） */
  async checkConnection(): Promise<ToolConnectionStatus> {
    const checkedAt = new Date().toISOString();
    const gitPath = this.settings.get().gitPath?.trim() || 'git';

    try {
      const git = simpleGit({ binary: gitPath });
      const raw = (await git.raw(['--version'])).trim();
      const version = raw.replace(/^git\s+version\s+/i, '') || raw;
      this.log.info('git', '接続確認 OK', raw);
      return {
        ok: true,
        tool: 'git',
        path: gitPath,
        version,
        message: `接続可能（${raw}）`,
        checkedAt,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.log.error('git', '接続確認失敗', detail);
      return {
        ok: false,
        tool: 'git',
        path: gitPath,
        message: `Git に接続できません。パス設定またはインストールを確認してください。（${detail}）`,
        checkedAt,
      };
    }
  }

  async status(cwd: string): Promise<GitStatusInfo> {
    try {
      const git = this.client(cwd);
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return {
          branch: '',
          ahead: 0,
          behind: 0,
          staged: [],
          modified: [],
          untracked: [],
          conflicted: [],
          isRepo: false,
        };
      }

      const s = await git.status();
      return {
        branch: s.current ?? '',
        ahead: s.ahead,
        behind: s.behind,
        staged: s.staged,
        modified: s.modified,
        untracked: s.not_added,
        conflicted: s.conflicted,
        isRepo: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.error('git', 'status 取得失敗', message);
      throw error;
    }
  }

  async commit(cwd: string, message: string, files: string[] = ['.']): Promise<string> {
    const git = this.client(cwd);
    await git.add(files);
    const result = await git.commit(message);
    this.log.info('git', `Commit: ${message}`, result.commit);
    return result.commit;
  }

  async push(cwd: string): Promise<string> {
    const git = this.client(cwd);
    const result = await git.push();
    this.log.info('git', 'Push 完了');
    return JSON.stringify(result);
  }

  async pull(cwd: string): Promise<string> {
    const git = this.client(cwd);
    const result = await git.pull();
    this.log.info('git', 'Pull 完了', JSON.stringify(result.summary));
    return JSON.stringify(result.summary);
  }

  async branches(cwd: string): Promise<GitBranchInfo> {
    const git = this.client(cwd);
    const summary = await git.branchLocal();
    return { current: summary.current, all: summary.all };
  }

  async checkout(cwd: string, branch: string): Promise<void> {
    const git = this.client(cwd);
    await git.checkout(branch);
    this.log.info('git', `Checkout: ${branch}`);
  }

  async createBranch(cwd: string, branch: string, checkout = true): Promise<void> {
    const git = this.client(cwd);
    if (checkout) {
      await git.checkoutLocalBranch(branch);
    } else {
      await git.branch([branch]);
    }
    this.log.info('git', `Branch 作成: ${branch}`);
  }

  /**
   * 簡易リリース: annotated tag を作成して push
   */
  async release(cwd: string, version: string, message?: string): Promise<string> {
    const git = this.client(cwd);
    const tag = version.startsWith('v') ? version : `v${version}`;
    await git.addAnnotatedTag(tag, message ?? `Release ${tag}`);
    await git.pushTags();
    this.log.info('git', `Release タグ作成: ${tag}`);
    return tag;
  }
}
