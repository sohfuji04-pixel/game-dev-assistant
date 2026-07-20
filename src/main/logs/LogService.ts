/**
 * 操作ログサービス
 * SQLite + userData/logs/ ファイルの二重保存。
 */
import { v4 as uuidv4 } from 'uuid';
import type { LogEntry } from '../../shared/types';
import type { DatabaseService } from '../database/DatabaseService';
import type { FileLogService } from './FileLogService';

export class LogService {
  constructor(
    private readonly db: DatabaseService,
    private readonly fileLog?: FileLogService,
  ) {}

  private write(
    level: LogEntry['level'],
    category: string,
    message: string,
    detail?: string,
  ): LogEntry {
    const entry: LogEntry = {
      id: uuidv4(),
      level,
      category,
      message,
      detail,
      createdAt: new Date().toISOString(),
    };

    this.db.run(
      `INSERT INTO logs (id, level, category, message, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [entry.id, entry.level, entry.category, entry.message, entry.detail ?? null, entry.createdAt],
    );

    this.fileLog?.write(level, category, message, detail);
    return entry;
  }

  info(category: string, message: string, detail?: string): LogEntry {
    return this.write('info', category, message, detail);
  }

  warn(category: string, message: string, detail?: string): LogEntry {
    return this.write('warn', category, message, detail);
  }

  error(category: string, message: string, detail?: string): LogEntry {
    return this.write('error', category, message, detail);
  }

  debug(category: string, message: string, detail?: string): LogEntry {
    return this.write('debug', category, message, detail);
  }

  list(limit = 200): LogEntry[] {
    return this.db.all<LogEntry>(
      `SELECT id, level, category, message, detail, created_at AS createdAt
       FROM logs ORDER BY created_at DESC LIMIT ?`,
      [limit],
    );
  }

  clear(): void {
    this.db.exec('DELETE FROM logs');
  }
}
