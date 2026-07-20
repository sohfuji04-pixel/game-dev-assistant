/**
 * Project Memory ViewModel
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type { AppViewModel } from './AppViewModel';
import type { ProjectMemory } from '@shared/types';
import { EMPTY_PROJECT_MEMORY } from '@shared/types';

export class ProjectMemoryViewModel extends ViewModelBase {
  draft: Omit<ProjectMemory, 'id' | 'projectPath' | 'updatedAt'> = { ...EMPTY_PROJECT_MEMORY };
  message = '';
  saving = false;

  constructor(private readonly app: AppViewModel) {
    super();
  }

  async load(): Promise<void> {
    const path = this.app.currentProject?.path;
    if (!path) {
      this.draft = { ...EMPTY_PROJECT_MEMORY };
      this.message = 'プロジェクトを開くと記憶を編集できます';
      this.notify();
      return;
    }
    const mem = await ApiClient.memoryGet(path);
    this.draft = mem
      ? {
          title: mem.title,
          genre: mem.genre,
          worldSetting: mem.worldSetting,
          characters: mem.characters,
          rules: mem.rules,
          engines: mem.engines,
          languages: mem.languages,
          folderNotes: mem.folderNotes,
          extra: mem.extra,
        }
      : { ...EMPTY_PROJECT_MEMORY };
    this.message = '';
    this.notify();
  }

  updateField(key: keyof typeof this.draft, value: string): void {
    this.draft = { ...this.draft, [key]: value };
    this.notify();
  }

  async save(): Promise<void> {
    const path = this.app.currentProject?.path;
    if (!path) {
      this.message = 'プロジェクトが未選択です';
      this.notify();
      return;
    }
    this.saving = true;
    this.notify();
    try {
      await ApiClient.memorySave(path, this.draft as unknown as Record<string, string>);
      this.message = 'Project Memory を保存しました（ChatGPT に自動反映されます）';
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.saving = false;
      this.notify();
    }
  }
}
