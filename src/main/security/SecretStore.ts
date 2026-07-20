/**
 * Electron safeStorage によるシークレット保存
 * API キー等を userData に暗号化して保持する（ソースに書かない）
 */
import { safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { LogService } from '../logs/LogService';

type SecretMap = Record<string, string>;

export class SecretStore {
  private readonly filePath: string;
  private cache: SecretMap = {};

  constructor(
    userDataPath: string,
    private readonly log: LogService,
  ) {
    this.filePath = path.join(userDataPath, 'secrets.json');
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.cache = {};
        return;
      }
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as SecretMap;
      this.cache = raw && typeof raw === 'object' ? raw : {};
    } catch (error) {
      this.log.warn('security', 'secrets.json の読み込みに失敗', String(error));
      this.cache = {};
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), 'utf-8');
  }

  set(key: string, plain: string): void {
    if (!plain) {
      delete this.cache[key];
      this.persist();
      return;
    }
    if (safeStorage.isEncryptionAvailable()) {
      this.cache[key] = safeStorage.encryptString(plain).toString('base64');
    } else {
      // フォールバック（暗号化不可環境）— 最低限 userData のみ
      this.cache[key] = Buffer.from(plain, 'utf-8').toString('base64');
      this.log.warn('security', 'safeStorage が利用できないため base64 保存にフォールバック');
    }
    this.persist();
  }

  get(key: string): string {
    const enc = this.cache[key];
    if (!enc) return '';
    try {
      const buf = Buffer.from(enc, 'base64');
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(buf);
      }
      return buf.toString('utf-8');
    } catch (error) {
      this.log.warn('security', `シークレット復号失敗: ${key}`, String(error));
      return '';
    }
  }

  has(key: string): boolean {
    return Boolean(this.cache[key]);
  }

  /** 設定画面表示用（末尾4文字以外マスク） */
  mask(key: string): string {
    const plain = this.get(key);
    if (!plain) return '';
    if (plain.length <= 4) return '••••';
    return `${'•'.repeat(Math.min(24, plain.length - 4))}${plain.slice(-4)}`;
  }
}

export const SECRET_OPENAI_KEY = 'openaiApiKey';
