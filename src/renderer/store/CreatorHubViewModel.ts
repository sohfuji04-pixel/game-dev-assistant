/**
 * 創作ツールハブ ViewModel
 * ツールはアプリ内 iframe で完結表示する。
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type { AppViewModel } from './AppViewModel';
import type { CreatorTool, DevServerStatus, HubScanResult } from '@shared/types';

export class CreatorHubViewModel extends ViewModelBase {
  scan: HubScanResult | null = null;
  server: DevServerStatus = {
    running: false,
    port: 8780,
    root: null,
    baseUrl: null,
    mode: 'idle',
  };
  message = '';
  loading = false;
  runningScript: string | null = null;
  lastLog = '';

  /** アプリ内で開いているツール */
  activeTool: CreatorTool | null = null;
  activeTitle = '';
  activeUrl: string | null = null;
  iframeKey = 0;
  iframeLoading = false;

  constructor(private readonly app: AppViewModel) {
    super();
  }

  get projectPath(): string | null {
    return this.app.currentProject?.path ?? null;
  }

  get isToolOpen(): boolean {
    return Boolean(this.activeUrl);
  }

  async load(): Promise<void> {
    this.loading = true;
    this.notify();
    try {
      this.server = await ApiClient.hubServerStatus();
      const root = this.projectPath;
      if (!root) {
        this.scan = null;
        this.message = '先にプロジェクトを開いてください';
        return;
      }
      this.scan = await ApiClient.hubScan(root);
      if (this.scan.kind === 'none') {
        this.message =
          '創作ツールが見つかりません。creator-hub.html かツール HTML があるプロジェクトを開いてください。';
      } else {
        this.message = '';
      }
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.loading = false;
      this.notify();
    }
  }

  async startServer(): Promise<void> {
    const root = this.projectPath;
    if (!root) return;
    this.loading = true;
    this.notify();
    try {
      this.server = await ApiClient.hubServerStart(root);
      this.message = `サーバ起動: ${this.server.baseUrl}`;
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.loading = false;
      this.notify();
    }
  }

  async stopServer(): Promise<void> {
    this.closeTool();
    this.server = await ApiClient.hubServerStop();
    this.message = 'サーバを停止しました';
    this.notify();
  }

  /** アプリ内でツールを開く */
  async openTool(htmlPath: string, title?: string, tool?: CreatorTool): Promise<void> {
    const root = this.projectPath;
    if (!root) return;
    this.iframeLoading = true;
    this.loading = true;
    this.message = 'ツールを読み込み中…';
    this.notify();
    try {
      const result = await ApiClient.hubOpenTool(root, htmlPath);
      this.server = await ApiClient.hubServerStatus();
      if (!result.success || !result.url) {
        this.message = result.message || 'ツールを開けませんでした';
        return;
      }
      this.activeTool = tool ?? null;
      this.activeTitle = title ?? tool?.title ?? htmlPath;
      this.activeUrl = result.url;
      this.iframeKey += 1;
      this.message = '';
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.loading = false;
      this.iframeLoading = false;
      this.notify();
    }
  }

  closeTool(): void {
    this.activeTool = null;
    this.activeTitle = '';
    this.activeUrl = null;
    this.iframeLoading = false;
    this.notify();
  }

  refreshTool(): void {
    if (!this.activeUrl) return;
    this.iframeKey += 1;
    this.iframeLoading = true;
    this.notify();
  }

  onIframeLoaded(href?: string): void {
    this.iframeLoading = false;
    // ツール内の「← ハブ」リンクで creator-hub に戻ったらアプリ側ハブへ
    if (href && /creator-hub\.html/i.test(href)) {
      this.closeTool();
      return;
    }
    this.notify();
  }

  async openExternal(): Promise<void> {
    if (!this.activeUrl) return;
    await ApiClient.hubOpenExternal(this.activeUrl);
    this.message = '外部ブラウザでも開きました';
    this.notify();
  }

  async runScript(script: string): Promise<void> {
    const root = this.projectPath;
    if (!root) return;
    this.runningScript = script;
    this.message = `実行中: npm run ${script}`;
    this.notify();
    try {
      const result = await ApiClient.hubRunScript(root, script);
      this.lastLog = result.log;
      this.message = result.message;
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.runningScript = null;
      this.notify();
    }
  }

  async openInCursor(): Promise<void> {
    const root = this.projectPath;
    if (!root) return;
    const result = await ApiClient.launchCursor(root);
    this.message = result.message;
    this.notify();
  }

  async revealProject(): Promise<void> {
    const root = this.projectPath;
    if (!root) return;
    await ApiClient.revealInFolder(root);
  }
}
