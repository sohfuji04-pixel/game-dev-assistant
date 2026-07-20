/**
 * SQLite データベースサービス（sql.js）
 * ネイティブビルド不要で、履歴・設定・ログ・最近のプロジェクトを永続化する。
 */
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export class DatabaseService {
  private db!: SqlJsDatabase;
  private SQL!: SqlJsStatic;
  private readonly dbPath: string;
  private persistTimer: NodeJS.Timeout | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  /** sql.js の初期化（非同期） */
  async init(): Promise<void> {
    const wasmPath = path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm');

    this.SQL = await initSqlJs({
      locateFile: () => wasmPath,
    });

    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new this.SQL.Database(fileBuffer);
    } else {
      this.db = new this.SQL.Database();
    }
  }

  /** スキーママイグレーション */
  migrate(): void {
    this.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recent_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        last_opened_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prompt_history (
        id TEXT PRIMARY KEY,
        prompt_id TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        used_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        level TEXT NOT NULL,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        detail TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS changelog (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        released_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        type TEXT NOT NULL,
        size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        thumbnail_data_url TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_prompt_history_used ON prompt_history(used_at DESC);
      CREATE INDEX IF NOT EXISTS idx_recent_opened ON recent_projects(last_opened_at DESC);
    `);

    this.seedChangelogIfEmpty();
    this.persist();
  }

  private seedChangelogIfEmpty(): void {
    const rows = this.all<{ c: number }>('SELECT COUNT(*) AS c FROM changelog');
    if ((rows[0]?.c ?? 0) > 0) return;

    const now = new Date().toISOString();
    this.run(
      `INSERT INTO changelog (id, version, title, body, released_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        'changelog-1.0.0',
        '1.0.0',
        '初回リリース',
        'ダッシュボード / Cursor連携 / Git / ファイル監視 / Assets / 自動更新 を実装',
        now,
      ],
    );
    this.run(
      `INSERT INTO changelog (id, version, title, body, released_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        'changelog-1.1.0',
        '1.1.0',
        '創作ツールハブ統合',
        'ぽこぽこ創作ツールハブを統合。カード UI・開発サーバ・本編反映パイプライン・操作性改善',
        now,
      ],
    );
  }

  /** 創作向け Prompt の初期シード */
  seedCreatorPromptsIfEmpty(): void {
    const rows = this.all<{ c: number }>('SELECT COUNT(*) AS c FROM prompts');
    if ((rows[0]?.c ?? 0) > 0) return;

    const now = new Date().toISOString();
    const seeds = [
      {
        id: 'prompt-board',
        title: '盤面 JSON を本編に反映',
        content:
          'tools/board-editor.html で書き出したステージ JSON を、本編のステージデータに安全にマージしてください。既存ステージを壊さないこと。',
        tags: ['board', 'pokopoko'],
      },
      {
        id: 'prompt-audio',
        title: 'Audio を apply:audio で焼き込み',
        content:
          'Audio Studio の上書きを確認し、`npm run apply:audio` で本編に反映する手順と注意点をまとめてください。',
        tags: ['audio', 'pipeline'],
      },
      {
        id: 'prompt-chars',
        title: 'キャラシート取り込み',
        content:
          'char-creator の出力を `npm run import:chars` で本編に取り込む。差分確認とロールバック方法も示してください。',
        tags: ['character', 'pipeline'],
      },
    ];

    for (const s of seeds) {
      this.run(
        `INSERT INTO prompts (id, title, content, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [s.id, s.title, s.content, JSON.stringify(s.tags), now, now],
      );
    }
  }

  /** 複数文実行 */
  exec(sql: string): void {
    this.db.exec(sql);
    this.schedulePersist();
  }

  /**
   * パラメータ付き実行（INSERT/UPDATE/DELETE）
   */
  run(sql: string, params: unknown[] = []): void {
    this.db.run(sql, params as never[]);
    this.schedulePersist();
  }

  /**
   * 複数行取得
   */
  all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql);
    const rows: T[] = [];
    try {
      stmt.bind(params as never[]);
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  /** 1行取得 */
  get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params as never[]);
      if (stmt.step()) {
        return stmt.getAsObject() as T;
      }
      return undefined;
    } finally {
      stmt.free();
    }
  }

  /** ディスクへ保存（デバウンス） */
  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persist(), 50);
  }

  persist(): void {
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  close(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.persist();
    this.db.close();
  }
}
