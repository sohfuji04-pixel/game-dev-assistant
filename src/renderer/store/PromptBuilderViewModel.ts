/**
 * Prompt Builder ViewModel
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type { AppViewModel } from './AppViewModel';

export class PromptBuilderViewModel extends ViewModelBase {
  gameContent = '';
  workContent = '';
  language = 'TypeScript';
  result = '';
  busy = false;
  message = '';

  constructor(private readonly app: AppViewModel) {
    super();
  }

  setField(field: 'gameContent' | 'workContent' | 'language', value: string): void {
    this[field] = value;
    this.notify();
  }

  async generate(): Promise<void> {
    this.busy = true;
    this.message = '';
    this.notify();
    try {
      this.result = await ApiClient.promptBuild({
        gameContent: this.gameContent,
        workContent: this.workContent,
        language: this.language,
        projectPath: this.app.currentProject?.path ?? null,
      });
      this.message = 'プロンプトを生成しました';
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.notify();
    }
  }

  async copy(): Promise<void> {
    if (!this.result) return;
    await navigator.clipboard.writeText(this.result);
    this.message = 'クリップボードにコピーしました';
    this.notify();
  }

  async sendToCursor(): Promise<void> {
    if (!this.result) return;
    await navigator.clipboard.writeText(this.result);
    const res = await ApiClient.cursorSendPrompt(
      this.result,
      this.app.currentProject?.path,
    );
    this.message = res.message;
    this.notify();
  }
}
