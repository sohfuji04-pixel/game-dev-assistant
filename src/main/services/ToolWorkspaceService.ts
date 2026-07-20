/**
 * 創作ツール専用画面（WebContentsView + file://）
 * ポート不要・カスタムプロトコル不要で、アプリ再起動なしにすぐ開ける。
 */
import { WebContentsView, type BrowserWindow, type Rectangle } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { LogService } from '../logs/LogService';

export type ToolViewBounds = Rectangle;

export class ToolWorkspaceService {
  private view: WebContentsView | null = null;
  private currentFile: string | null = null;

  constructor(private readonly log: LogService) {}

  isOpen(): boolean {
    return this.view !== null;
  }

  async show(
    win: BrowserWindow,
    projectRoot: string,
    htmlPath: string,
    bounds: ToolViewBounds,
  ): Promise<{ success: boolean; message: string; filePath?: string }> {
    const normalized = htmlPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const filePath = path.join(projectRoot, ...normalized.split('/'));
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return { success: false, message: `ファイルがありません: ${normalized}` };
    }

    const url = pathToFileURL(filePath).href;
    const view = this.ensureView(win);
    this.applyBounds(view, bounds);

    try {
      if (this.currentFile !== filePath) {
        await view.webContents.loadURL(url);
        this.currentFile = filePath;
      } else {
        // 同じファイルでも再表示時はリロードして最新を反映
        await view.webContents.loadURL(url);
      }
      this.log.info('hub', '専用画面を表示', url);
      return { success: true, message: `アプリ内画面: ${normalized}`, filePath };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.error('hub', '専用画面の表示に失敗', message);
      return { success: false, message };
    }
  }

  setBounds(bounds: ToolViewBounds): void {
    if (!this.view) return;
    this.applyBounds(this.view, bounds);
  }

  reload(): void {
    this.view?.webContents.reloadIgnoringCache();
  }

  hide(win?: BrowserWindow | null): void {
    if (!this.view) return;
    const parent = win ?? null;
    try {
      if (parent && !parent.isDestroyed()) {
        parent.contentView.removeChildView(this.view);
      }
    } catch {
      /* already detached */
    }
    try {
      if (!this.view.webContents.isDestroyed()) {
        this.view.webContents.close();
      }
    } catch {
      /* ignore */
    }
    this.view = null;
    this.currentFile = null;
    this.log.info('hub', '専用画面を閉じました');
  }

  private ensureView(win: BrowserWindow): WebContentsView {
    if (this.view && !this.view.webContents.isDestroyed()) {
      // 親に付いていなければ付け直す
      const children = win.contentView.children;
      if (!children.includes(this.view)) {
        win.contentView.addChildView(this.view);
      }
      return this.view;
    }

    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        // file:// の相対リソースを許可
        webSecurity: true,
      },
    });
    view.setBackgroundColor('#ffffff');
    win.contentView.addChildView(view);
    this.view = view;
    return view;
  }

  private applyBounds(view: WebContentsView, bounds: ToolViewBounds): void {
    view.setBounds({
      x: Math.max(0, Math.round(bounds.x)),
      y: Math.max(0, Math.round(bounds.y)),
      width: Math.max(1, Math.round(bounds.width)),
      height: Math.max(1, Math.round(bounds.height)),
    });
  }
}
