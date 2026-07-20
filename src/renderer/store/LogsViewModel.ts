/**
 * ログ画面 ViewModel
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type { LogEntry } from '@shared/types';

export class LogsViewModel extends ViewModelBase {
  logs: LogEntry[] = [];
  loading = false;

  async load(): Promise<void> {
    this.loading = true;
    this.notify();
    try {
      this.logs = await ApiClient.listLogs(500);
    } finally {
      this.loading = false;
      this.notify();
    }
  }

  async clear(): Promise<void> {
    await ApiClient.clearLogs();
    await this.load();
  }
}
