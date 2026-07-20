/**
 * Cursor 連携サービス
 * Cursor 起動・フォルダオープン・Prompt 管理を担当する。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import type { PromptHistoryItem, PromptItem, ToolConnectionStatus } from '../../shared/types';
import type { DatabaseService } from './DatabaseService';
import type { LogService } from './LogService';
import type { SettingsService } from './SettingsService';

export class CursorService {
  constructor(
    private readonly db: DatabaseService,
    private readonly settings: SettingsService,
    private readonly log: LogService,
  ) {}

  /** Cursor.exe の存在・実行可否を確認する */
  async checkConnection(): Promise<ToolConnectionStatus> {
    const checkedAt = new Date().toISOString();
    const exe = this.settings.get().cursorExePath?.trim() ?? '';

    if (!exe) {
      return {
        ok: false,
        tool: 'cursor',
        path: '',
        message: 'Cursor.exe のパスが未設定です。設定画面で指定してください。',
        checkedAt,
      };
    }

    if (!fs.existsSync(exe)) {
      return {
        ok: false,
        tool: 'cursor',
        path: exe,
        message: '指定パスに Cursor.exe が見つかりません。',
        checkedAt,
      };
    }

    try {
      const st = fs.statSync(exe);
      if (!st.isFile()) {
        return {
          ok: false,
          tool: 'cursor',
          path: exe,
          message: 'パスは存在しますが実行ファイルではありません。',
          checkedAt,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, tool: 'cursor', path: exe, message, checkedAt };
    }

    // Cursor.exe を spawn すると GUI が開くため、接続確認では起動しない
    this.log.info('cursor', '接続確認 OK（ファイル確認のみ）', exe);
    return {
      ok: true,
      tool: 'cursor',
      path: exe,
      message: '接続可能（実行ファイルを確認済み）',
      checkedAt,
    };
  }

  /** Cursor を起動（任意でフォルダを開く） */
  async launch(folderPath?: string): Promise<{ success: boolean; message: string }> {
    const exe = this.settings.get().cursorExePath?.trim() ?? '';
    if (!exe || !fs.existsSync(exe)) {
      const message = 'Cursor.exe のパスが未設定、または見つかりません。設定画面で指定してください。';
      this.log.error('cursor', message);
      return { success: false, message };
    }

    const args = folderPath ? [folderPath] : [];
    try {
      spawn(exe, args, { detached: true, stdio: 'ignore' }).unref();
      this.log.info('cursor', 'Cursor を起動しました', folderPath ?? '(フォルダなし)');
      return { success: true, message: 'Cursor を起動しました' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.error('cursor', 'Cursor 起動に失敗', message);
      return { success: false, message };
    }
  }

  listPrompts(): PromptItem[] {
    return this.db
      .all<Record<string, unknown>>(
        `SELECT id, title, content, tags, created_at AS createdAt, updated_at AS updatedAt
         FROM prompts ORDER BY updated_at DESC`,
      )
      .map((row) => this.mapPrompt(row));
  }

  savePrompt(input: {
    id?: string;
    title: string;
    content: string;
    tags?: string[];
  }): PromptItem {
    const now = new Date().toISOString();
    const id = input.id ?? uuidv4();
    const existing = input.id
      ? this.db.get<{ id: string }>('SELECT id FROM prompts WHERE id = ?', [id])
      : undefined;

    const item: PromptItem = {
      id,
      title: input.title,
      content: input.content,
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };

    if (existing) {
      const prev = this.db.get<{ created_at: string }>('SELECT created_at FROM prompts WHERE id = ?', [
        id,
      ]);
      item.createdAt = prev?.created_at ?? now;
      this.db.run(
        `UPDATE prompts SET title = ?, content = ?, tags = ?, updated_at = ? WHERE id = ?`,
        [item.title, item.content, JSON.stringify(item.tags), item.updatedAt, item.id],
      );
    } else {
      this.db.run(
        `INSERT INTO prompts (id, title, content, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.title,
          item.content,
          JSON.stringify(item.tags),
          item.createdAt,
          item.updatedAt,
        ],
      );
    }

    this.log.info('prompt', `Prompt を保存: ${item.title}`);
    return item;
  }

  deletePrompt(id: string): void {
    this.db.run('DELETE FROM prompts WHERE id = ?', [id]);
    this.log.info('prompt', `Prompt を削除: ${id}`);
  }

  searchPrompts(query: string): PromptItem[] {
    const q = `%${query.toLowerCase()}%`;
    return this.db
      .all<Record<string, unknown>>(
        `SELECT id, title, content, tags, created_at AS createdAt, updated_at AS updatedAt
         FROM prompts
         WHERE lower(title) LIKE ? OR lower(content) LIKE ? OR lower(tags) LIKE ?
         ORDER BY updated_at DESC`,
        [q, q, q],
      )
      .map((row) => this.mapPrompt(row));
  }

  listHistory(limit = 100): PromptHistoryItem[] {
    return this.db.all<PromptHistoryItem>(
      `SELECT id, prompt_id AS promptId, title, content, used_at AS usedAt
       FROM prompt_history ORDER BY used_at DESC LIMIT ?`,
      [limit],
    );
  }

  addHistory(input: {
    promptId?: string | null;
    title: string;
    content: string;
  }): PromptHistoryItem {
    const item: PromptHistoryItem = {
      id: uuidv4(),
      promptId: input.promptId ?? null,
      title: input.title,
      content: input.content,
      usedAt: new Date().toISOString(),
    };
    this.db.run(
      `INSERT INTO prompt_history (id, prompt_id, title, content, used_at)
       VALUES (?, ?, ?, ?, ?)`,
      [item.id, item.promptId, item.title, item.content, item.usedAt],
    );
    return item;
  }

  private mapPrompt(row: Record<string, unknown>): PromptItem {
    return {
      id: String(row.id),
      title: String(row.title),
      content: String(row.content),
      tags: JSON.parse(String(row.tags ?? '[]')) as string[],
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    };
  }
}
