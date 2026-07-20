/**
 * 創作ツールハブ ViewModel
 * WebContentsView 専用画面で開く（ポート不要・再起動不要）
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type { AppViewModel } from './AppViewModel';
import type { CreatorTool, HubScanResult } from '@shared/types';

export class CreatorHubViewModel extends ViewModelBase {
  scan: HubScanResult | null = null;
  message = '';
  loading = false;
  runningScript: string | null = null;
  lastLog = '';

  activeTool: CreatorTool | null = null;
  activeTitle = '';
  activeHtmlPath = '';
  toolLoading = false;

  constructor(private readonly app: AppViewModel) {
    super();
  }

  get projectPath(): string | null {
    return this.app.currentProject?.path ?? null;
  }

  get isToolOpen(): boolean {
    return Boolean(this.activeHtmlPath);
  }

  async load(): Promise<void> {
    this.loading = true;
    this.notify();
    try {
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

  /** UI を先に開き、レイアウト後に mountToolView で実体を載せる */
  async openTool(htmlPath: string, title?: string, tool?: CreatorTool): Promise<void> {
    const root = this.projectPath;
    if (!root) return;

    this.activeTool = tool ?? null;
    this.activeTitle = title ?? tool?.title ?? htmlPath;
    this.activeHtmlPath = htmlPath;
    this.toolLoading = true;
    this.message = '';
    this.app.setHubActiveToolId(tool?.id ?? null);
    this.notify();
  }

  async mountToolView(bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<void> {
    const root = this.projectPath;
    if (!root || !this.activeHtmlPath) return;
    this.toolLoading = true;
    this.notify();
    try {
      const result = await ApiClient.hubShowToolView({
        projectRoot: root,
        htmlPath: this.activeHtmlPath,
        bounds,
      });
      if (!result.success) {
        this.message = result.message || 'ツールを開けませんでした';
      } else {
        this.message = '';
      }
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.toolLoading = false;
      this.notify();
    }
  }

  async updateToolBounds(bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<void> {
    if (!this.isToolOpen) return;
    await ApiClient.hubSetToolBounds(bounds);
  }

  async openToolById(toolId: string): Promise<void> {
    const tool = this.scan?.tools.find((t) => t.id === toolId);
    if (!tool) {
      this.message = `ツールが見つかりません: ${toolId}（プロジェクトを開いているか確認してください）`;
      this.app.setHubActiveToolId(null);
      this.notify();
      return;
    }
    await this.openTool(tool.htmlPath, tool.title, tool);
  }

  async closeTool(): Promise<void> {
    try {
      await ApiClient.hubHideToolView();
    } catch {
      /* ignore */
    }
    this.activeTool = null;
    this.activeTitle = '';
    this.activeHtmlPath = '';
    this.toolLoading = false;
    this.app.setHubActiveToolId(null);
    this.notify();
  }

  async refreshTool(): Promise<void> {
    if (!this.isToolOpen) return;
    this.toolLoading = true;
    this.notify();
    try {
      await ApiClient.hubReloadToolView();
    } finally {
      this.toolLoading = false;
      this.notify();
    }
  }

  async openExternal(): Promise<void> {
    const root = this.projectPath;
    if (!root || !this.activeHtmlPath) return;
    const fakeUrl = `gda-project://workspace/${this.activeHtmlPath.replace(/^\/+/, '')}`;
    await ApiClient.hubOpenExternal(fakeUrl, root);
    this.message = '既定アプリで開きました';
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
