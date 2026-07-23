/**
 * UI 作成 AI ViewModel — ChatGPT（Web・APIキー不要）
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type { AppViewModel } from './AppViewModel';
import type {
  UiColorPalette,
  UiCreateAiChatGptPack,
  UiCreateAiRequest,
  UiCreateAiResult,
  UiDeviceTarget,
  UiOrientation,
  UiScreenId,
  UiThemeId,
} from '@shared/types';

type ThemeOption = {
  id: string;
  label: string;
  description: string;
  palette: UiColorPalette;
};

type ScreenOption = {
  id: string;
  label: string;
  description: string;
  typicalIcons: string[];
};

export class UiCreateAiViewModel extends ViewModelBase {
  prompt = 'かわいい牧場ゲーム\nホーム画面';
  themeId: UiThemeId = 'auto';
  screenId: UiScreenId | 'auto' = 'auto';
  orientation: UiOrientation = 'portrait';
  deviceTarget: UiDeviceTarget = 'both';
  includeReview = true;
  themes: ThemeOption[] = [];
  screens: ScreenOption[] = [];
  /** ChatGPT に渡す依頼プロンプト */
  chatGptPack: UiCreateAiChatGptPack | null = null;
  /** ChatGPT 返答の貼り付け欄 */
  pasteDraft = '';
  result: UiCreateAiResult | null = null;
  busy = false;
  message = '';

  constructor(private readonly app: AppViewModel) {
    super();
  }

  async load(): Promise<void> {
    try {
      const [themes, screens] = await Promise.all([
        ApiClient.uiCreateThemes(),
        ApiClient.uiCreateScreens(),
      ]);
      this.themes = themes;
      this.screens = screens;
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    }
    this.notify();
  }

  setPrompt(value: string): void {
    this.prompt = value;
    this.notify();
  }

  setThemeId(id: UiThemeId): void {
    this.themeId = id;
    this.notify();
  }

  setScreenId(id: UiScreenId | 'auto'): void {
    this.screenId = id;
    this.notify();
  }

  setOrientation(value: UiOrientation): void {
    this.orientation = value;
    this.notify();
  }

  setDeviceTarget(value: UiDeviceTarget): void {
    this.deviceTarget = value;
    this.notify();
  }

  setIncludeReview(value: boolean): void {
    this.includeReview = value;
    this.notify();
  }

  setPasteDraft(value: string): void {
    this.pasteDraft = value;
    this.notify();
  }

  get previewPalette(): UiColorPalette | null {
    if (this.result?.palette) return this.result.palette;
    if (this.chatGptPack?.palette) return this.chatGptPack.palette;
    if (this.themeId === 'auto') return this.themes[0]?.palette ?? null;
    return this.themes.find((t) => t.id === this.themeId)?.palette ?? null;
  }

  private buildRequest(): UiCreateAiRequest {
    return {
      prompt: this.prompt,
      themeId: this.themeId,
      screenId: this.screenId === 'auto' ? null : this.screenId,
      orientation: this.orientation,
      deviceTarget: this.deviceTarget,
      includeReview: this.includeReview,
      projectPath: this.app.currentProject?.path ?? null,
    };
  }

  /** プロンプトを組み立て → コピー → ChatGPT を開く（キー不要） */
  async openWithChatGpt(): Promise<void> {
    this.busy = true;
    this.message = '';
    this.notify();
    try {
      this.chatGptPack = await ApiClient.uiCreatePrepareChatGpt(this.buildRequest());
      await navigator.clipboard.writeText(this.chatGptPack.chatGptPrompt);
      await ApiClient.uiCreateOpenChatGpt(this.chatGptPack.chatgptUrl);
      this.message = this.chatGptPack.instructions;
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.notify();
    }
  }

  async copyChatGptPrompt(): Promise<void> {
    this.busy = true;
    this.message = '';
    this.notify();
    try {
      if (!this.chatGptPack) {
        this.chatGptPack = await ApiClient.uiCreatePrepareChatGpt(this.buildRequest());
      }
      await navigator.clipboard.writeText(this.chatGptPack.chatGptPrompt);
      this.message = 'ChatGPT 用プロンプトをコピーしました';
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.notify();
    }
  }

  async applyPaste(): Promise<void> {
    this.busy = true;
    this.message = '';
    this.notify();
    try {
      this.result = await ApiClient.uiCreateAcceptPaste(this.buildRequest(), this.pasteDraft);
      this.message = `ChatGPT の返答を取り込みました（${this.result.detectedGenre} / ${this.result.appliedThemeId} / ${this.result.appliedScreenId}）`;
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.notify();
    }
  }

  async reReview(): Promise<void> {
    if (!this.result?.markdown) return;
    this.busy = true;
    this.message = '';
    this.notify();
    try {
      const pack = await ApiClient.uiCreatePrepareReview(this.result.markdown);
      await navigator.clipboard.writeText(pack.chatGptPrompt);
      await ApiClient.uiCreateOpenChatGpt(pack.chatgptUrl);
      this.chatGptPack = pack;
      this.message = pack.instructions;
    } catch (error) {
      this.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.notify();
    }
  }

  async copy(): Promise<void> {
    if (!this.result?.markdown) return;
    await navigator.clipboard.writeText(this.result.markdown);
    this.message = 'クリップボードにコピーしました';
    this.notify();
  }

  async copyCursorPrompt(): Promise<void> {
    if (!this.result?.markdown) return;
    const extracted = extractCursorPromptSection(this.result.markdown);
    await navigator.clipboard.writeText(extracted);
    this.message = '⑦ Cursor実装プロンプトをコピーしました';
    this.notify();
  }

  async sendToCursor(): Promise<void> {
    if (!this.result?.markdown) return;
    const extracted = extractCursorPromptSection(this.result.markdown);
    await navigator.clipboard.writeText(extracted);
    const res = await ApiClient.cursorSendPrompt(
      extracted,
      this.app.currentProject?.path,
    );
    this.message = res.message;
    this.notify();
  }
}

function extractCursorPromptSection(markdown: string): string {
  const match = markdown.match(
    /(?:^|\n)#+\s*⑦[^\n]*\n([\s\S]*?)(?=\n#+\s*[⑧⑨⑩⑪]|\n#+\s*\d|[^\S\r\n]*$)/,
  );
  if (match?.[1]?.trim()) return match[1].trim();
  return markdown;
}
