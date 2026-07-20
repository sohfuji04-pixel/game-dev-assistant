/**
 * Unity AI ViewModel
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type { UnityChatMessage, UnityConnectionStatus, UnityQuickCommand } from '@shared/types';

export class UnityViewModel extends ViewModelBase {
  connection: UnityConnectionStatus | null = null;
  commands: UnityQuickCommand[] = [];
  messages: UnityChatMessage[] = [];
  packagePath = '';
  draft = '';
  busy = false;
  message = '';
  private unsubs: Array<() => void> = [];

  async load(): Promise<void> {
    this.connection = await ApiClient.unityStatus();
    this.commands = await ApiClient.unityQuickCommands();
    this.messages = await ApiClient.unityChatHistory();
    this.packagePath = await ApiClient.unityPackagePath();
    this.unsubs.push(
      ApiClient.onUnityConnectionChanged((status) => {
        this.connection = status;
        this.notify();
      }),
      ApiClient.onUnityChatProgress((msg) => {
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

  async connect(): Promise<void> {
    this.busy = true;
    this.notify();
    try {
      this.connection = await ApiClient.unityConnect();
      this.message = this.connection.connected
        ? `接続済み（${this.connection.projectName ?? 'Unity'} ${this.connection.unityVersion ?? ''}）`
        : '接続できませんでした';
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.notify();
    }
  }

  async disconnect(): Promise<void> {
    await ApiClient.unityDisconnect();
    this.connection = await ApiClient.unityStatus();
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
      await ApiClient.unityChatSend(text);
      this.messages = await ApiClient.unityChatHistory();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.notify();
    }
  }

  async runQuick(id: string): Promise<void> {
    const cmd = this.commands.find((c) => c.id === id);
    if (!cmd?.phrase || this.busy) return;
    this.busy = true;
    this.notify();
    try {
      await ApiClient.unityChatSend(cmd.phrase);
      this.messages = await ApiClient.unityChatHistory();
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.notify();
    }
  }

  async clearChat(): Promise<void> {
    await ApiClient.unityChatClear();
    this.messages = [];
    this.notify();
  }
}
