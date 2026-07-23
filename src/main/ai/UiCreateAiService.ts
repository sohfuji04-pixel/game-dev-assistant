/**
 * ゲーム UI 作成 AI — ChatGPT（Web・APIキー不要）向け
 * OpenAI API は使わず、依頼プロンプトを組み立てて ChatGPT に渡す。
 */
import { shell } from 'electron';
import type { ProjectMemoryService } from './ProjectMemoryService';
import type { LogService } from '../logs/LogService';
import type {
  UiColorPalette,
  UiCreateAiChatGptPack,
  UiCreateAiRequest,
  UiCreateAiResult,
  UiThemeId,
} from '../../shared/types/uiCreateAi';
import {
  UI_THEMES,
  UI_SCREENS,
  detectGenreLabel,
  detectScreenFromText,
  detectThemeFromText,
  getScreenById,
  getThemeById,
} from '../../shared/uiCreateAi';
import { loadUiCreateReviewPrompt, loadUiCreateSystemPrompt } from './prompts/uiCreateAi/loadPrompts';

export const CHATGPT_WEB_URL = 'https://chatgpt.com/';

function formatPalette(palette: UiColorPalette): string {
  return [
    `Primary: ${palette.primary}`,
    `Secondary: ${palette.secondary}`,
    `Accent: ${palette.accent}`,
    `Background: ${palette.background}`,
    `Text: ${palette.text}`,
    `Warning: ${palette.warning}`,
    `Success: ${palette.success}`,
  ].join('\n');
}

export class UiCreateAiService {
  constructor(
    private readonly memory: ProjectMemoryService,
    private readonly log: LogService,
  ) {}

  listThemes() {
    return UI_THEMES.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      palette: t.palette,
    }));
  }

  listScreens() {
    return UI_SCREENS.map((s) => ({
      id: s.id,
      label: s.label,
      description: s.description,
      typicalIcons: s.typicalIcons,
    }));
  }

  resolveTheme(themeId: UiThemeId | undefined, prompt: string) {
    if (themeId && themeId !== 'auto') {
      return getThemeById(themeId) ?? detectThemeFromText(prompt);
    }
    return detectThemeFromText(prompt);
  }

  resolveScreen(screenId: UiCreateAiRequest['screenId'], prompt: string) {
    if (screenId && screenId !== 'custom') {
      return getScreenById(screenId) ?? detectScreenFromText(prompt);
    }
    return detectScreenFromText(prompt);
  }

  /** ChatGPT 用プロンプトを組み立て（APIキー不要） */
  prepareChatGpt(input: UiCreateAiRequest): UiCreateAiChatGptPack {
    const { context, theme, screen, genre } = this.buildContext(input);
    const system = loadUiCreateSystemPrompt();
    const chatGptPrompt = [
      system,
      '',
      '---',
      '',
      context,
      '',
      '【重要】OpenAI APIキーは不要です。この ChatGPT チャット上で Markdown として必須セクションをすべて出力してください。前置きは不要です。',
    ].join('\n');

    this.log.info('ui-create-ai', `ChatGPT用プロンプト準備 theme=${theme.id} screen=${screen.id}`);

    return {
      chatGptPrompt,
      chatgptUrl: CHATGPT_WEB_URL,
      detectedGenre: genre,
      appliedThemeId: theme.id,
      appliedScreenId: screen.id,
      palette: theme.palette,
      preparedAt: new Date().toISOString(),
      instructions:
        'プロンプトをコピー済みです。開いた ChatGPT に貼り付けて送信し、返答の Markdown をこの画面へ貼り付けてください。',
    };
  }

  /** 改善レビュー用プロンプト（APIキー不要） */
  prepareReviewPrompt(markdown: string): UiCreateAiChatGptPack {
    const body = (markdown ?? '').trim();
    if (!body) throw new Error('レビュー対象の Markdown がありません。');
    const chatGptPrompt = [
      loadUiCreateReviewPrompt(),
      '',
      '---',
      '',
      '【レビュー対象】',
      body.slice(0, 24000),
    ].join('\n');
    return {
      chatGptPrompt,
      chatgptUrl: CHATGPT_WEB_URL,
      detectedGenre: '',
      appliedThemeId: '',
      appliedScreenId: '',
      palette: {
        primary: '#888',
        secondary: '#666',
        accent: '#aaa',
        background: '#111',
        text: '#eee',
        warning: '#f5a',
        success: '#5a5',
      },
      preparedAt: new Date().toISOString(),
      instructions:
        '改善レビュー用プロンプトをコピーしました。ChatGPT に貼り付けて送信し、返答を結果へ追記してください。',
    };
  }

  /** ChatGPT 返答を結果として取り込む */
  acceptPaste(input: UiCreateAiRequest, markdown: string): UiCreateAiResult {
    const text = (markdown ?? '').trim();
    if (!text) throw new Error('ChatGPT の返答 Markdown を貼り付けてください。');
    const { theme, screen, genre } = this.buildContext(input);
    return {
      markdown: text,
      detectedGenre: genre,
      appliedThemeId: theme.id,
      appliedScreenId: screen.id,
      palette: theme.palette,
      generatedAt: new Date().toISOString(),
      source: 'paste',
    };
  }

  async openChatGpt(url = CHATGPT_WEB_URL): Promise<{ ok: boolean; url: string }> {
    const target = url?.trim() || CHATGPT_WEB_URL;
    await shell.openExternal(target);
    this.log.info('ui-create-ai', 'ChatGPT を外部ブラウザで開きました', target);
    return { ok: true, url: target };
  }

  private buildContext(input: UiCreateAiRequest) {
    const prompt = (input.prompt ?? '').trim();
    if (!prompt) {
      throw new Error('UI の説明（例: かわいい牧場ゲーム / ホーム画面）を入力してください。');
    }

    const theme = this.resolveTheme(input.themeId, prompt);
    const screen = this.resolveScreen(input.screenId, prompt);
    const genre = detectGenreLabel(prompt);
    const orientation = input.orientation ?? 'portrait';
    const deviceTarget = input.deviceTarget ?? 'both';
    const implementationTarget =
      input.implementationTarget?.trim() || 'Capacitor + HTML / CSS / TypeScript';
    const includeReview = input.includeReview !== false;

    const mem = input.projectPath
      ? this.memory.getByProjectPath(input.projectPath) ||
        this.memory.seedPokopokoIfNeeded(input.projectPath)
      : null;
    const memoryBlock = this.memory.toContextBlock(mem);

    const context = [
      memoryBlock,
      `【ユーザー入力】\n${prompt}`,
      `【推定ジャンル】\n${genre}`,
      `【適用テーマ】\n${theme.label} (${theme.id})\n${theme.description}\nフォント候補: ${theme.fontHints.join(', ')}`,
      `【カラーパレット（尊重すること。微調整する場合は理由を書く）】\n${formatPalette(theme.palette)}`,
      `【対象画面】\n${screen.label} (${screen.id})\n${screen.description}`,
      `【推奨コンポーネント】\n${screen.typicalComponents.join(', ')}`,
      `【推奨アイコン案】\n${screen.typicalIcons.join(', ')}`,
      `【向き】\n${orientation === 'portrait' ? '縦画面' : '横画面'}`,
      `【デバイス】\n${
        deviceTarget === 'phone'
          ? 'Androidスマホ'
          : deviceTarget === 'tablet'
            ? 'Androidタブレット'
            : 'Androidスマホ + タブレット'
      }`,
      `【実装ターゲット】\n${implementationTarget}`,
      includeReview
        ? '【追加】セクション⑪ UI改善AIレビューを必ず含めること。'
        : '【追加】セクション⑪は省略してよい。',
      '上記に基づき、必須セクション①〜⑩' +
        (includeReview ? '＋⑪' : '') +
        'を高品質に一括生成してください。',
    ]
      .filter(Boolean)
      .join('\n\n');

    return { context, theme, screen, genre };
  }
}
