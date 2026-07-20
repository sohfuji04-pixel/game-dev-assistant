/**
 * プロジェクト管理サービス
 * 最近開いたプロジェクトの記録と監視開始を行う。
 */
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { ChangelogEntry, RecentProject } from '../../shared/types';
import type { DatabaseService } from './DatabaseService';
import type { LogService } from './LogService';
import type { WatcherService } from './WatcherService';

export class ProjectService {
  constructor(
    private readonly db: DatabaseService,
    private readonly log: LogService,
    private readonly watcher: WatcherService,
  ) {}

  listRecent(limit = 20): RecentProject[] {
    return this.db.all<RecentProject>(
      `SELECT id, name, path, last_opened_at AS lastOpenedAt
       FROM recent_projects ORDER BY last_opened_at DESC LIMIT ?`,
      [limit],
    );
  }

  open(projectPath: string): RecentProject {
    if (!fs.existsSync(projectPath)) {
      throw new Error(`パスが存在しません: ${projectPath}`);
    }

    const name = path.basename(projectPath);
    const now = new Date().toISOString();
    const existing = this.db.get<{ id: string }>('SELECT id FROM recent_projects WHERE path = ?', [
      projectPath,
    ]);

    const project: RecentProject = {
      id: existing?.id ?? uuidv4(),
      name,
      path: projectPath,
      lastOpenedAt: now,
    };

    this.db.run(
      `INSERT INTO recent_projects (id, name, path, last_opened_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET
         name = excluded.name,
         last_opened_at = excluded.last_opened_at`,
      [project.id, project.name, project.path, project.lastOpenedAt],
    );

    this.watcher.start(projectPath);
    this.log.info('project', `プロジェクトを開きました: ${name}`, projectPath);
    return project;
  }

  removeRecent(id: string): void {
    this.db.run('DELETE FROM recent_projects WHERE id = ?', [id]);
  }

  listChangelog(): ChangelogEntry[] {
    return this.db.all<ChangelogEntry>(
      `SELECT id, version, title, body, released_at AS releasedAt
       FROM changelog ORDER BY released_at DESC`,
    );
  }
}
