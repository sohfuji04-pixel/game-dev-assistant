/**
 * UI 作成 AI ViewModel
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type { AppViewModel } from './AppViewModel';
import type {
  UiColorPalette,
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

  get previewPalette(): UiColorPalette | null {
    if (this.result?.palette) return this.result.palette;
    if (this.themeId === 'auto') return this.themes[0]?.palette ?? null;
    return this.themes.find((t) => t.id === this.themeId)?.palette ?? null;
  }

  async generate(): Promise<void> {
    this.busy = true;
    this.message = '';
    this.notify();
    try {
      this.result = await ApiClient.uiCreateGenerate({
        prompt: this.prompt,
        themeId: this.themeId,
        screenId: this.screenId === 'auto' ? null : this.screenId,
        orientation: this.orientation,
        deviceTarget: this.deviceTarget,
        includeReview: this.includeReview,
        projectPath: this.app.currentProject?.path ?? null,
      });
      this.message = `生成完了（${this.result.detectedGenre} / ${this.result.appliedThemeId} / ${this.result.appliedScreenId}）`;
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
      const review = await ApiClient.uiCreateReview(this.result.markdown);
      this.result = {
        ...this.result,
        markdown: `${this.result.markdown.trim()}\n\n---\n\n# ⑪ UI改善AIレビュー（再実行）\n\n${review.trim()}\n`,
      };
      this.message = '改善レビューを追記しました';
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
