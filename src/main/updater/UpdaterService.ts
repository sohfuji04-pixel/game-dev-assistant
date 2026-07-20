/**
 * 自動更新サービス（electron-updater）
 * GitHub Releases から取得。起動時確認・再試行・日本語メッセージ対応。
 */
import electronUpdater from 'electron-updater';
import type { AppSettings, UpdaterStatus } from '../../shared/types';
import type { LogService } from '../logs/LogService';

const { autoUpdater } = electronUpdater;

export class UpdaterService {
  private status: UpdaterStatus = { status: 'idle' };
  private retryLeft = 0;

  constructor(
    private readonly onStatus: (status: UpdaterStatus) => void,
    private readonly log?: LogService,
  ) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;

    autoUpdater.on('checking-for-update', () => {
      this.emit({ status: 'checking', message: '更新を確認しています…' });
    });

    autoUpdater.on('update-available', (info) => {
      this.emit({
        status: 'available',
        version: info.version,
        message: `新しいバージョンがあります（v${info.version}）`,
      });
      this.log?.info('updater', `更新あり: v${info.version}`);
    });

    autoUpdater.on('update-not-available', () => {
      this.emit({ status: 'not-available', message: '最新版です' });
      this.log?.info('updater', '更新なし（最新）');
    });

    autoUpdater.on('download-progress', (progress) => {
      this.emit({
        status: 'downloading',
        progress: progress.percent,
        message: `ダウンロード中… ${progress.percent.toFixed(1)}%`,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.emit({
        status: 'downloaded',
        version: info.version,
        message: 'ダウンロード完了。再起動してインストールします',
      });
      this.log?.info('updater', `ダウンロード完了: v${info.version}`);
    });

    autoUpdater.on('error', (error) => {
      const message = this.mapError(error);
      this.emit({ status: 'error', message });
      this.log?.error('updater', '更新エラー', message);
      void this.maybeRetry();
    });
  }

  /** 設定を反映（owner/repo/channel） */
  applySettings(settings: AppSettings): void {
    this.retryLeft = settings.updateRetryCount;
    // setFeedURL は GitHub プロバイダ向け
    try {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: settings.updateOwner,
        repo: settings.updateRepo,
        private: false,
      });
      autoUpdater.channel = settings.updateChannel;
    } catch (error) {
      this.log?.warn('updater', 'setFeedURL 失敗', String(error));
    }
  }

  getStatus(): UpdaterStatus {
    return this.status;
  }

  async checkForUpdates(settings?: AppSettings): Promise<UpdaterStatus> {
    if (settings) this.applySettings(settings);
    try {
      this.log?.info('updater', '更新確認開始');
      await autoUpdater.checkForUpdates();
    } catch (error) {
      const message = this.mapError(error);
      this.emit({ status: 'error', message });
      this.log?.error('updater', '更新確認失敗', message);
      await this.maybeRetry();
    }
    return this.status;
  }

  async downloadUpdate(): Promise<UpdaterStatus> {
    try {
      this.log?.info('updater', 'ダウンロード開始');
      await autoUpdater.downloadUpdate();
    } catch (error) {
      const message = this.mapError(error);
      this.emit({ status: 'error', message });
      this.log?.error('updater', 'ダウンロード失敗', message);
      await this.maybeRetry(true);
    }
    return this.status;
  }

  /** ダウンロード済みなら再起動してインストール */
  quitAndInstall(): void {
    this.log?.info('updater', '再起動してインストール');
    autoUpdater.quitAndInstall(false, true);
  }

  private async maybeRetry(download = false): Promise<void> {
    if (this.retryLeft <= 0) return;
    this.retryLeft -= 1;
    this.log?.warn('updater', `再試行します（残り ${this.retryLeft}）`);
    await new Promise((r) => setTimeout(r, 2000));
    if (download) await this.downloadUpdate();
    else await this.checkForUpdates();
  }

  private mapError(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    if (/ENOTFOUND|ECONNREFUSED|net::|network/i.test(raw)) {
      return '通信に失敗しました。ネットワーク接続を確認してください。';
    }
    if (/401|403|404|GitHub/i.test(raw)) {
      return 'GitHub への接続または Release の取得に失敗しました。owner/repo 設定を確認してください。';
    }
    return raw || '更新エラーが発生しました';
  }

  private emit(status: UpdaterStatus): void {
    this.status = status;
    this.onStatus(status);
  }
}
