/**
 * 設定サービス
 * テーマ / 保存場所 / Cursor / Git / Android SDK / 更新設定を管理する。
 * データは SQLite（userData）に保存され、アプリ更新後も保持される。
 */
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_SETTINGS, type AppSettings } from '../../shared/types';
import type { DatabaseService } from '../database/DatabaseService';

const SETTINGS_KEY = 'app_settings';

export class SettingsService {
  private cache: AppSettings | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly userDataPath: string,
  ) {}

  async ensureDefaults(): Promise<AppSettings> {
    const current = this.get();
    let changed = false;

    if (!current.dataPath) {
      current.dataPath = path.join(this.userDataPath, 'data');
      changed = true;
    }
    if (!current.cursorExePath) {
      current.cursorExePath = this.detectCursorPath();
      changed = true;
    }

    // 永続ディレクトリ（アップデートで消えない userData 配下）
    fs.mkdirSync(current.dataPath, { recursive: true });
    fs.mkdirSync(path.join(this.userDataPath, 'logs'), { recursive: true });
    fs.mkdirSync(path.join(this.userDataPath, 'cache'), { recursive: true });
    fs.mkdirSync(path.join(this.userDataPath, 'plugins'), { recursive: true });
    for (const sub of ['image', 'bgm', 'se'] as const) {
      fs.mkdirSync(path.join(current.dataPath, 'assets', sub), { recursive: true });
    }

    if (changed) this.set(current);
    return current;
  }

  get(): AppSettings {
    if (this.cache) return { ...this.cache };

    const row = this.db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
      SETTINGS_KEY,
    ]);

    if (!row) {
      this.cache = { ...DEFAULT_SETTINGS };
      this.persist(this.cache);
      return { ...this.cache };
    }

    this.cache = { ...DEFAULT_SETTINGS, ...(JSON.parse(row.value) as AppSettings) };
    return { ...this.cache };
  }

  set(partial: Partial<AppSettings>): AppSettings {
    const next = { ...this.get(), ...partial };
    this.persist(next);
    this.cache = next;
    return { ...next };
  }

  getLogsDir(): string {
    return path.join(this.userDataPath, 'logs');
  }

  getAssetsRoot(): string {
    return path.join(this.get().dataPath, 'assets');
  }

  private persist(settings: AppSettings): void {
    this.db.run(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [SETTINGS_KEY, JSON.stringify(settings)],
    );
  }

  private detectCursorPath(): string {
    const localAppData = process.env.LOCALAPPDATA ?? '';
    const candidates = [
      path.join(localAppData, 'Programs', 'cursor', 'Cursor.exe'),
      path.join(localAppData, 'cursor', 'Cursor.exe'),
      'C:\\Program Files\\Cursor\\Cursor.exe',
    ];
    return candidates.find((p) => fs.existsSync(p)) ?? '';
  }
}
