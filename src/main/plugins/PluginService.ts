/**
 * プラグインホスト
 * 将来の拡張のため、plugins ディレクトリからマニフェストを読み込む。
 * プラグインは { id, name, version, description, enabled } を持つ plugin.json を想定。
 */
import fs from 'node:fs';
import path from 'node:path';
import type { PluginManifest } from '../../shared/types';

export interface PluginModule {
  manifest: PluginManifest;
  /** 任意のコマンド実行フック（将来拡張） */
  invoke?: (command: string, payload?: unknown) => Promise<unknown> | unknown;
}

export class PluginService {
  private plugins = new Map<string, PluginModule>();

  constructor(private readonly pluginsDir: string) {}

  async loadAll(): Promise<PluginManifest[]> {
    this.plugins.clear();
    fs.mkdirSync(this.pluginsDir, { recursive: true });

    // 組み込みのサンプルプラグイン（構造デモ）
    this.register({
      manifest: {
        id: 'builtin.hello',
        name: 'Hello Plugin',
        version: '1.0.0',
        description: 'プラグイン基盤のサンプル（将来拡張用）',
        enabled: true,
      },
      invoke: (command) => {
        if (command === 'ping') return { pong: true, at: new Date().toISOString() };
        throw new Error(`Unknown command: ${command}`);
      },
    });

    const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(this.pluginsDir, entry.name, 'plugin.json');
      if (!fs.existsSync(manifestPath)) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as PluginManifest;
        this.register({
          manifest: { ...raw, enabled: raw.enabled !== false },
        });
      } catch {
        // 壊れたプラグインはスキップ
      }
    }

    return this.list();
  }

  list(): PluginManifest[] {
    return [...this.plugins.values()].map((p) => p.manifest);
  }

  async invoke(pluginId: string, command: string, payload?: unknown): Promise<unknown> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`プラグインが見つかりません: ${pluginId}`);
    if (!plugin.manifest.enabled) throw new Error(`プラグインが無効です: ${pluginId}`);
    if (!plugin.invoke) throw new Error(`プラグインに invoke がありません: ${pluginId}`);
    return plugin.invoke(command, payload);
  }

  private register(module: PluginModule): void {
    this.plugins.set(module.manifest.id, module);
  }
}
