/**
 * プラグイン拡張用のレンダラー側ホスト（将来用）
 * メインプロセスの PluginService と対になる薄いラッパ。
 */
import { ApiClient } from '../services/ApiClient';
import type { PluginManifest } from '@shared/types';

export class PluginHost {
  async list(): Promise<PluginManifest[]> {
    return ApiClient.listPlugins();
  }

  async invoke(pluginId: string, command: string, payload?: unknown): Promise<unknown> {
    return ApiClient.invokePlugin(pluginId, command, payload);
  }
}
