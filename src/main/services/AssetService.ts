/**
 * Assets 管理サービス
 * 画像 / BGM / SE のインポート・一覧・サムネイル生成を担当する。
 */
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { AssetItem, AssetType } from '../../shared/types';
import type { DatabaseService } from './DatabaseService';
import type { LogService } from './LogService';
import type { SettingsService } from './SettingsService';

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac']);

export class AssetService {
  constructor(
    private readonly db: DatabaseService,
    private readonly settings: SettingsService,
    private readonly log: LogService,
  ) {}

  list(type?: AssetType): AssetItem[] {
    if (type) {
      return this.db.all<AssetItem>(
        `SELECT id, name, path, type, size, mime_type AS mimeType,
                thumbnail_data_url AS thumbnailDataUrl, created_at AS createdAt
         FROM assets WHERE type = ? ORDER BY created_at DESC`,
        [type],
      );
    }
    return this.db.all<AssetItem>(
      `SELECT id, name, path, type, size, mime_type AS mimeType,
              thumbnail_data_url AS thumbnailDataUrl, created_at AS createdAt
       FROM assets ORDER BY created_at DESC`,
    );
  }

  /**
   * ファイルパス配列を assets ディレクトリへコピーして登録する
   */
  async importFiles(filePaths: string[], preferredType?: AssetType): Promise<AssetItem[]> {
    const imported: AssetItem[] = [];
    for (const source of filePaths) {
      const item = await this.importOne(source, preferredType);
      if (item) imported.push(item);
    }
    this.log.info('assets', `${imported.length} 件のアセットをインポート`);
    return imported;
  }

  private async importOne(source: string, preferredType?: AssetType): Promise<AssetItem | null> {
    if (!fs.existsSync(source)) return null;

    const ext = path.extname(source).toLowerCase();
    const type = preferredType ?? this.detectType(ext, path.basename(source));
    const name = path.basename(source);
    const destDir = path.join(this.settings.getAssetsRoot(), type);
    fs.mkdirSync(destDir, { recursive: true });

    const dest = path.join(destDir, `${Date.now()}_${name}`);
    fs.copyFileSync(source, dest);

    const stat = fs.statSync(dest);
    const mimeType = this.guessMime(ext);
    let thumbnailDataUrl: string | undefined;

    if (type === 'image' && ext !== '.svg' && stat.size <= 2 * 1024 * 1024) {
      try {
        const buf = fs.readFileSync(dest);
        thumbnailDataUrl = `data:${mimeType};base64,${buf.toString('base64')}`;
      } catch {
        thumbnailDataUrl = undefined;
      }
    }

    const item: AssetItem = {
      id: uuidv4(),
      name,
      path: dest,
      type,
      size: stat.size,
      mimeType,
      thumbnailDataUrl,
      createdAt: new Date().toISOString(),
    };

    this.db.run(
      `INSERT INTO assets
       (id, name, path, type, size, mime_type, thumbnail_data_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.name,
        item.path,
        item.type,
        item.size,
        item.mimeType,
        item.thumbnailDataUrl ?? null,
        item.createdAt,
      ],
    );

    return item;
  }

  delete(id: string): void {
    const row = this.db.get<{ path: string }>('SELECT path FROM assets WHERE id = ?', [id]);
    if (row?.path && fs.existsSync(row.path)) {
      fs.unlinkSync(row.path);
    }
    this.db.run('DELETE FROM assets WHERE id = ?', [id]);
    this.log.info('assets', `アセット削除: ${id}`);
  }

  private detectType(ext: string, filename: string): AssetType {
    if (IMAGE_EXT.has(ext)) return 'image';
    if (AUDIO_EXT.has(ext)) {
      const lower = filename.toLowerCase();
      if (lower.includes('bgm') || lower.includes('music')) return 'bgm';
      return 'se';
    }
    return 'other';
  }

  private guessMime(ext: string): string {
    const map: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
    };
    return map[ext] ?? 'application/octet-stream';
  }
}
