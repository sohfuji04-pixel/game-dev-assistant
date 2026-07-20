/**
 * ファイルログサービス
 * userData/logs/ に日次ローテーションで保存する（アップデート後も保持）。
 */
import fs from 'node:fs';
import path from 'node:path';

export type FileLogLevel = 'info' | 'warn' | 'error' | 'debug';

export class FileLogService {
  constructor(private readonly logsDir: string) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  write(level: FileLogLevel, category: string, message: string, detail?: string): void {
    const line = [
      new Date().toISOString(),
      level.toUpperCase().padEnd(5),
      `[${category}]`,
      message,
      detail ? `| ${detail.replace(/\s+/g, ' ').slice(0, 500)}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    const file = path.join(this.logsDir, `app-${this.today()}.log`);
    try {
      fs.appendFileSync(file, `${line}\n`, 'utf-8');
    } catch {
      // ディスク障害時は握りつぶし（アプリ継続優先）
    }
  }

  info(category: string, message: string, detail?: string): void {
    this.write('info', category, message, detail);
  }

  warn(category: string, message: string, detail?: string): void {
    this.write('warn', category, message, detail);
  }

  error(category: string, message: string, detail?: string): void {
    this.write('error', category, message, detail);
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
