/**
 * Blender AI ViewModel
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type {
  BlenderChatMessage,
  BlenderConnectionStatus,
  BlenderTemplateInfo,
} from '@shared/types';

export class BlenderViewModel extends ViewModelBase {
  connection: BlenderConnectionStatus | null = null;
  exeCheck: { ok: boolean; path: string; message: string } | null = null;
  templates: BlenderTemplateInfo[] = [];
  messages: BlenderChatMessage[] = [];
  draft = '';
  busy = false;
  message = '';
  private unsubs: Array<() => void> = [];

  async load(): Promise<void> {
    this.connection = await ApiClient.blenderStatus();
    this.exeCheck = await ApiClient.blenderCheckExe();
    this.templates = await ApiClient.blenderTemplatesList();
    this.messages = await ApiClient.blenderChatHistory();
    this.unsubs.push(
      ApiClient.onBlenderConnectionChanged((status) => {
        this.connection = status;
        this.notify();
      }),
      ApiClient.onBlenderChatProgress((msg) => {
        const idx = this.messages.findIndex((m) => m.id === msg.id);
        if (idx >= 0) this.messages[idx] = msg;
        else this.messages = [...this.messages, msg];
        this.notify();
      }),
    );
    this.notify();
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }

  setDraft(value: string): void {
    this.draft = value;
    this.notify();
  }

  async launch(): Promise<void> {
    this.busy = true;
    this.notify();
    try {
      const result = await ApiClient.blenderLaunch();
      this.message = result.message;
      this.connection = await ApiClient.blenderStatus();
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
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.notify();
    }
  }

  async disconnect(): Promise<void> {
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
    this.notify();
    try {
      const msg = await ApiClient.blenderChatSend(text);
      const idx = this.messages.findIndex((m) => m.id === msg.id);
      if (idx >= 0) this.messages[idx] = msg;
      else this.messages = await ApiClient.blenderChatHistory();
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
    this.notify();
    try {
      await ApiClient.blenderTemplatesRun(id);
      this.messages = await ApiClient.blenderChatHistory();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.notify();
    }
  }

  async clearChat(): Promise<void> {
    await ApiClient.blenderChatClear();
    this.messages = [];
    this.notify();
  }
}
