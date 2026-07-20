/**
 * Project Memory — プロジェクト文脈の永続化
 */
import { v4 as uuidv4 } from 'uuid';
import type { ProjectMemory } from '../../shared/types/projectMemory';
import { EMPTY_PROJECT_MEMORY } from '../../shared/types/projectMemory';
import type { DatabaseService } from '../database/DatabaseService';

export class ProjectMemoryService {
  constructor(private readonly db: DatabaseService) {}

  getByProjectPath(projectPath: string): ProjectMemory | null {
    if (!projectPath) return null;
    const row = this.db.get<Record<string, unknown>>(
      `SELECT id, project_path AS projectPath, title, genre, world_setting AS worldSetting,
              characters, rules, engines, languages, folder_notes AS folderNotes, extra,
              updated_at AS updatedAt
       FROM project_memory WHERE project_path = ?`,
      [projectPath],
    );
    return row ? this.map(row) : null;
  }

  upsert(
    projectPath: string,
    partial: Partial<Omit<ProjectMemory, 'id' | 'projectPath' | 'updatedAt'>>,
  ): ProjectMemory {
    const existing = this.getByProjectPath(projectPath);
    const now = new Date().toISOString();
    if (existing) {
      const next: ProjectMemory = {
        ...existing,
        ...partial,
        projectPath,
        updatedAt: now,
      };
      this.db.run(
        `UPDATE project_memory SET title=?, genre=?, world_setting=?, characters=?, rules=?,
         engines=?, languages=?, folder_notes=?, extra=?, updated_at=? WHERE id=?`,
        [
          next.title,
          next.genre,
          next.worldSetting,
          next.characters,
          next.rules,
          next.engines,
          next.languages,
          next.folderNotes,
          next.extra,
          next.updatedAt,
          next.id,
        ],
      );
      return next;
    }

    const created: ProjectMemory = {
      id: uuidv4(),
      projectPath,
      ...EMPTY_PROJECT_MEMORY,
      ...partial,
      updatedAt: now,
    };
    this.db.run(
      `INSERT INTO project_memory
       (id, project_path, title, genre, world_setting, characters, rules, engines, languages, folder_notes, extra, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        created.id,
        created.projectPath,
        created.title,
        created.genre,
        created.worldSetting,
        created.characters,
        created.rules,
        created.engines,
        created.languages,
        created.folderNotes,
        created.extra,
        created.updatedAt,
      ],
    );
    return created;
  }

  /** チャット System 文脈用の要約テキスト */
  toContextBlock(memory: ProjectMemory | null): string {
    if (!memory) return '';
    const lines = [
      '【現在のゲーム / プロジェクト記憶】',
      memory.title && `タイトル: ${memory.title}`,
      memory.genre && `ジャンル: ${memory.genre}`,
      memory.worldSetting && `世界観: ${memory.worldSetting}`,
      memory.characters && `キャラクター: ${memory.characters}`,
      memory.rules && `ルール: ${memory.rules}`,
      memory.engines && `使用エンジン/技術: ${memory.engines}`,
      memory.languages && `使用言語: ${memory.languages}`,
      memory.folderNotes && `フォルダ構成: ${memory.folderNotes}`,
      memory.extra && `その他: ${memory.extra}`,
    ].filter(Boolean);
    if (lines.length <= 1) return '';
    return lines.join('\n');
  }

  seedPokopokoIfNeeded(projectPath: string): ProjectMemory | null {
    if (!projectPath) return null;
    const existing = this.getByProjectPath(projectPath);
    if (existing) return existing;
    const name = projectPath.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? '';
    if (!name.includes('pokopoko') && !name.includes('ぽこぽこ')) return null;
    return this.upsert(projectPath, {
      title: 'ぽこぽこピースと奇跡の群島',
      genre: '牧場パズル',
      worldSetting: '癒し系',
      engines: 'Electron / Capacitor / Cursor / Blender',
      languages: 'TypeScript / JavaScript',
      characters: '',
      rules: '',
      folderNotes: '',
      extra: '',
    });
  }

  private map(row: Record<string, unknown>): ProjectMemory {
    return {
      id: String(row.id),
      projectPath: String(row.projectPath),
      title: String(row.title ?? ''),
      genre: String(row.genre ?? ''),
      worldSetting: String(row.worldSetting ?? ''),
      characters: String(row.characters ?? ''),
      rules: String(row.rules ?? ''),
      engines: String(row.engines ?? ''),
      languages: String(row.languages ?? ''),
      folderNotes: String(row.folderNotes ?? ''),
      extra: String(row.extra ?? ''),
      updatedAt: String(row.updatedAt ?? ''),
    };
  }
}
