/**
 * Cursor / Prompt 管理 ViewModel
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type { PromptHistoryItem, PromptItem, ToolConnectionStatus } from '@shared/types';

export class CursorViewModel extends ViewModelBase {
  prompts: PromptItem[] = [];
  history: PromptHistoryItem[] = [];
  connection: ToolConnectionStatus | null = null;
  searchQuery = '';
  editing: PromptItem | null = null;
  draftTitle = '';
  draftContent = '';
  draftTags = '';
  message = '';
  loading = false;
  checking = false;

  async load(): Promise<void> {
    this.loading = true;
    this.notify();
    try {
      this.connection = await ApiClient.checkCursorConnection();
      this.prompts = this.searchQuery
        ? await ApiClient.searchPrompts(this.searchQuery)
        : await ApiClient.listPrompts();
      this.history = await ApiClient.listPromptHistory();
    } finally {
      this.loading = false;
      this.notify();
    }
  }

  async checkConnection(): Promise<void> {
    this.checking = true;
    this.notify();
    try {
      this.connection = await ApiClient.checkCursorConnection();
      this.message = this.connection.message;
    } finally {
      this.checking = false;
      this.notify();
    }
  }

  setSearch(query: string): void {
    this.searchQuery = query;
    this.notify();
  }

  setDraftTitle(value: string): void {
    this.draftTitle = value;
    this.notify();
  }

  setDraftContent(value: string): void {
    this.draftContent = value;
    this.notify();
  }

  setDraftTags(value: string): void {
    this.draftTags = value;
    this.notify();
  }

  async search(): Promise<void> {
    await this.load();
  }

  startCreate(): void {
    this.editing = null;
    this.draftTitle = '';
    this.draftContent = '';
    this.draftTags = '';
    this.notify();
  }

  startEdit(item: PromptItem): void {
    this.editing = item;
    this.draftTitle = item.title;
    this.draftContent = item.content;
    this.draftTags = item.tags.join(', ');
    this.notify();
  }

  async save(): Promise<void> {
    if (!this.draftTitle.trim() || !this.draftContent.trim()) {
      this.message = 'タイトルと内容は必須です';
      this.notify();
      return;
    }
    await ApiClient.savePrompt({
      id: this.editing?.id,
      title: this.draftTitle.trim(),
      content: this.draftContent,
      tags: this.draftTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    this.message = 'Prompt を保存しました';
    this.startCreate();
    await this.load();
  }

  async remove(id: string): Promise<void> {
    await ApiClient.deletePrompt(id);
    this.message = '削除しました';
    await this.load();
  }

  async usePrompt(item: PromptItem): Promise<void> {
    await ApiClient.addPromptHistory({
      promptId: item.id,
      title: item.title,
      content: item.content,
    });
    await navigator.clipboard.writeText(item.content);
    this.message = 'クリップボードにコピーし、履歴へ記録しました';
    await this.load();
  }

  async launchCursor(): Promise<void> {
    const result = await ApiClient.launchCursor();
    this.message = result.message;
    this.notify();
  }

  async openFolder(): Promise<void> {
    const result = await ApiClient.openFolderInCursor();
    this.message = result.message;
    this.notify();
  }
}
