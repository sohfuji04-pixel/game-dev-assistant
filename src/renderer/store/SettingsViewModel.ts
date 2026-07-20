/**
 * 設定画面 ViewModel
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type {
  AppSettings,
  AppTheme,
  PluginManifest,
  ToolConnectionStatus,
  UpdaterStatus,
} from '@shared/types';
import type { AppViewModel } from './AppViewModel';

export class SettingsViewModel extends ViewModelBase {
  draft: AppSettings | null = null;
  plugins: PluginManifest[] = [];
  updater: UpdaterStatus = { status: 'idle' };
  cursorStatus: ToolConnectionStatus | null = null;
  gitStatus: ToolConnectionStatus | null = null;
  checkingConnections = false;
  message = '';
  saving = false;
  /** API キー入力欄（保存時のみ SecretStore へ送る） */
  openaiKeyDraft = '';
  openaiKeyMask = '';

  constructor(private readonly app: AppViewModel) {
    super();
  }

  async load(): Promise<void> {
    this.draft = await ApiClient.getSettings();
    this.openaiKeyMask = await ApiClient.getOpenAiKeyMask();
    this.openaiKeyDraft = '';
    this.plugins = await ApiClient.listPlugins();
    this.updater = await ApiClient.getUpdaterStatus();
    this.notify();
    await this.checkConnections();
  }

  updateField<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    if (!this.draft) return;
    this.draft = { ...this.draft, [key]: value };
    this.notify();
  }

  setOpenAiKeyDraft(value: string): void {
    this.openaiKeyDraft = value;
    this.notify();
  }

  setTheme(theme: AppTheme): void {
    this.updateField('theme', theme);
  }

  async browse(field: keyof AppSettings, directory: boolean, title: string): Promise<void> {
    const selected = await ApiClient.selectPath({ title, directory });
    if (selected) {
      this.updateField(field, selected as AppSettings[typeof field]);
    }
  }

  async save(): Promise<void> {
    if (!this.draft) return;
    this.saving = true;
    this.notify();
    try {
      const { openaiApiKey: _drop, ...rest } = this.draft;
      this.draft = await ApiClient.setSettings(rest);
      if (this.openaiKeyDraft.trim()) {
        const res = await ApiClient.setOpenAiKey(this.openaiKeyDraft.trim());
        this.openaiKeyMask = res.mask;
        this.openaiKeyDraft = '';
      } else {
        this.openaiKeyMask = await ApiClient.getOpenAiKeyMask();
      }
      await this.app.refreshSettings();
      this.message = '設定を保存しました（APIキーは暗号化保存）';
      await this.checkConnections();
    } finally {
      this.saving = false;
      this.notify();
    }
  }

  async checkConnections(): Promise<void> {
    this.checkingConnections = true;
    this.notify();
    try {
      // 未保存のパス変更も反映してから確認する
      if (this.draft) {
        await ApiClient.setSettings({
          cursorExePath: this.draft.cursorExePath,
          gitPath: this.draft.gitPath,
        });
      }
      const snapshot = await ApiClient.checkToolsConnections();
      this.cursorStatus = snapshot.cursor;
      this.gitStatus = snapshot.git;
      this.message = [
        snapshot.cursor.ok ? 'Cursor: OK' : 'Cursor: NG',
        snapshot.git.ok ? 'Git: OK' : 'Git: NG',
      ].join(' / ');
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.checkingConnections = false;
      this.notify();
    }
  }

  async checkUpdate(): Promise<void> {
    this.updater = await ApiClient.checkUpdate();
    // 想定内の「利用不可」はバナーを赤くしない
    if (this.updater.status === 'not-available' || this.updater.status === 'idle') {
      this.message = this.updater.message ?? '更新確認が完了しました';
    } else if (this.updater.status === 'error') {
      this.message = this.updater.message ?? '更新確認に失敗しました';
    } else {
      this.message = this.updater.message ?? '';
    }
    this.notify();
  }

  async downloadUpdate(): Promise<void> {
    this.updater = await ApiClient.downloadUpdate();
    this.message = this.updater.message ?? '';
    this.notify();
  }

  async installUpdate(): Promise<void> {
    await ApiClient.installUpdate();
  }

  async pingPlugin(id: string): Promise<void> {
    const result = await ApiClient.invokePlugin(id, 'ping');
    this.message = `Plugin ${id}: ${JSON.stringify(result)}`;
    this.notify();
  }
}
