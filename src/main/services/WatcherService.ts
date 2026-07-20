/**
 * ファイル監視サービス（chokidar）
 * 画像 / json / ts / tsx / png / svg の変更を検知して UI へ通知する。
 */
import chokidar, { type FSWatcher } from 'chokidar';
import path from 'node:path';
import type { WatcherEvent } from '../../shared/types';

const WATCH_EXTENSIONS = new Set(['.json', '.ts', '.tsx', '.png', '.svg', '.jpg', '.jpeg', '.webp', '.gif']);

export class WatcherService {
  private watcher: FSWatcher | null = null;
  private rootPath: string | null = null;

  constructor(private readonly onEvent: (event: WatcherEvent) => void) {}

  start(rootPath: string): { success: boolean; message: string } {
    this.stop();
    this.rootPath = rootPath;

    this.watcher = chokidar.watch(rootPath, {
      ignored: [
        /(^|[/\\])\../,
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
    });

    const emit = (type: WatcherEvent['type'], filePath: string) => {
      const extension = path.extname(filePath).toLowerCase();
      if (!WATCH_EXTENSIONS.has(extension)) return;
      this.onEvent({
        type,
        path: filePath,
        extension,
        timestamp: new Date().toISOString(),
      });
    };

    this.watcher
      .on('add', (p) => emit('add', p))
      .on('change', (p) => emit('change', p))
      .on('unlink', (p) => emit('unlink', p));

    return { success: true, message: `監視開始: ${rootPath}` };
  }

  stop(): void {
    if (this.watcher) {
      void this.watcher.close();
      this.watcher = null;
    }
    this.rootPath = null;
  }

  getRoot(): string | null {
    return this.rootPath;
  }
}
