/**
 * Blender AI ViewModel
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type {
  BlenderChatMessage,
  BlenderConnectionStatus,
  BlenderPreviewResult,
  BlenderTemplateInfo,
} from '@shared/types';

export class BlenderViewModel extends ViewModelBase {
  connection: BlenderConnectionStatus | null = null;
  exeCheck: { ok: boolean; path: string; message: string } | null = null;
  templates: BlenderTemplateInfo[] = [];
  messages: BlenderChatMessage[] = [];
  draft = '';
  busy = false;
  previewLoading = false;
  autoPreview = true;
  previewMode: 'viewport' | 'render' = 'viewport';
  preview: BlenderPreviewResult | null = null;
  previewUrl = '';
  /** 履歴クリア後は手動更新までプレビューを出さない */
  previewCleared = false;
  message = '';
  photoMode: 'reference' | 'relief' | 'scene' = 'scene';
  private unsubs: Array<() => void> = [];
  /** 進行中の refreshPreview を無効化するための世代番号 */
  private previewEpoch = 0;

  async load(): Promise<void> {
    this.connection = await ApiClient.blenderStatus();
    this.exeCheck = await ApiClient.blenderCheckExe();
    this.templates = await ApiClient.blenderTemplatesList();
    this.messages = await ApiClient.blenderChatHistory();
    this.unsubs.push(
      ApiClient.onBlenderConnectionChanged((status) => {
        this.connection = status;
        this.notify();
        if (status.connected && this.autoPreview && !this.previewCleared) {
          void this.refreshPreview();
        }
      }),
      ApiClient.onBlenderChatProgress((msg) => {
        const idx = this.messages.findIndex((m) => m.id === msg.id);
        if (idx >= 0) this.messages[idx] = msg;
        else this.messages = [...this.messages, msg];
        this.notify();
        if (
          msg.status === 'done' &&
          this.autoPreview &&
          this.connection?.connected &&
          !this.previewCleared
        ) {
          void this.refreshPreview();
        }
      }),
    );
    this.notify();
    if (this.connection?.connected && !this.previewCleared) {
      void this.refreshPreview();
    }
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }

  setDraft(value: string): void {
    this.draft = value;
    this.notify();
  }

  setAutoPreview(value: boolean): void {
    this.autoPreview = value;
    this.notify();
  }

  setPreviewMode(mode: 'viewport' | 'render'): void {
    this.previewMode = mode;
    this.notify();
    if (this.connection?.connected && !this.previewCleared) {
      void this.refreshPreview();
    }
  }

  setPhotoMode(mode: 'reference' | 'relief' | 'scene'): void {
    this.photoMode = mode;
    this.notify();
  }

  private clearPreviewState(): void {
    this.previewEpoch += 1;
    this.preview = null;
    this.previewUrl = '';
    this.previewLoading = false;
    this.previewCleared = true;
  }

  async refreshPreview(): Promise<void> {
    if (!this.connection?.connected) return;
    const epoch = ++this.previewEpoch;
    this.previewCleared = false;
    this.previewLoading = true;
    this.notify();
    try {
      const result = await ApiClient.blenderPreview({
        width: 720,
        height: 405,
        mode: this.previewMode,
      });
      // 履歴クリア等で世代が進んでいれば結果を捨てる
      if (epoch !== this.previewEpoch) return;
      this.preview = result;
      this.previewUrl =
        result.ok && result.data ? `data:${result.mimeType};base64,${result.data}` : '';
      if (!result.ok) {
        this.message = result.message ?? 'プレビューの取得に失敗しました';
      }
    } catch (error) {
      if (epoch !== this.previewEpoch) return;
      this.previewUrl = '';
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      if (epoch === this.previewEpoch) {
        this.previewLoading = false;
        this.notify();
      }
    }
  }

  async launch(): Promise<void> {
    this.busy = true;
    this.notify();
    try {
      const result = await ApiClient.blenderLaunch();
      this.message = result.message;
      this.connection = await ApiClient.blenderStatus();
      if (this.connection.connected && !this.previewCleared) await this.refreshPreview();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.notify();
    }
  }

  async connect(): Promise<void> {
    this.busy = true;
    this.notify();
    try {
      this.connection = await ApiClient.blenderConnect();
      this.message = this.connection.connected
        ? `接続済み（Blender ${this.connection.blenderVersion ?? '?'}）`
        : '接続できませんでした';
      if (this.connection.connected && !this.previewCleared) await this.refreshPreview();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.notify();
    }
  }

  async disconnect(): Promise<void> {
    this.clearPreviewState();
    await ApiClient.blenderDisconnect();
    this.connection = await ApiClient.blenderStatus();
    this.message = '切断しました';
    this.notify();
  }

  async send(): Promise<void> {
    const text = this.draft.trim();
    if (!text || this.busy) return;
    this.draft = '';
    this.busy = true;
    this.previewCleared = false;
    this.notify();
    try {
      const msg = await ApiClient.blenderChatSend(text);
      const idx = this.messages.findIndex((m) => m.id === msg.id);
      if (idx >= 0) this.messages[idx] = msg;
      else this.messages = await ApiClient.blenderChatHistory();
      if (this.autoPreview) await this.refreshPreview();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.notify();
    }
  }

  async runTemplate(id: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.previewCleared = false;
    this.notify();
    try {
      await ApiClient.blenderTemplatesRun(id);
      this.messages = await ApiClient.blenderChatHistory();
      if (this.autoPreview) await this.refreshPreview();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.notify();
    }
  }

  async generateFromPhoto(): Promise<void> {
    if (this.busy || !this.connection?.connected) return;
    this.busy = true;
    this.previewCleared = false;
    this.message = '';
    this.notify();
    try {
      const msg = await ApiClient.blenderGenerateFromPhoto({ mode: this.photoMode });
      if (!msg) {
        this.message = '写真の選択がキャンセルされました';
        return;
      }
      const idx = this.messages.findIndex((m) => m.id === msg.id);
      if (idx >= 0) this.messages[idx] = msg;
      else this.messages = await ApiClient.blenderChatHistory();
      if (msg.status === 'error') {
        this.message = msg.content;
      }
      if (this.autoPreview && msg.status === 'done') await this.refreshPreview();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.notify();
    }
  }

  async clearChat(): Promise<void> {
    this.clearPreviewState();
    this.messages = [];
    this.notify();
    try {
      await ApiClient.blenderChatClear();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    }
    // 非同期完了後もプレビューを空に保つ（進行中の取得結果を捨てたあとの再適用防止）
    this.preview = null;
    this.previewUrl = '';
    this.previewLoading = false;
    this.previewCleared = true;
    this.notify();
  }
}
