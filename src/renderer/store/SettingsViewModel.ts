/**
 * 設定画面 ViewModel
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type { AppSettings, AppTheme, PluginManifest, UpdaterStatus } from '@shared/types';
import type { AppViewModel } from './AppViewModel';

export class SettingsViewModel extends ViewModelBase {
  draft: AppSettings | null = null;
  plugins: PluginManifest[] = [];
  updater: UpdaterStatus = { status: 'idle' };
  message = '';
  saving = false;

  constructor(private readonly app: AppViewModel) {
    super();
  }

  async load(): Promise<void> {
    this.draft = await ApiClient.getSettings();
    this.plugins = await ApiClient.listPlugins();
    this.updater = await ApiClient.getUpdaterStatus();
    this.notify();
  }

  updateField<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    if (!this.draft) return;
    this.draft = { ...this.draft, [key]: value };
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
      this.draft = await ApiClient.setSettings(this.draft);
      await this.app.refreshSettings();
      this.message = '設定を保存しました';
    } finally {
      this.saving = false;
      this.notify();
    }
  }

  async checkUpdate(): Promise<void> {
    this.updater = await ApiClient.checkUpdate();
    this.message = this.updater.message ?? '';
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
