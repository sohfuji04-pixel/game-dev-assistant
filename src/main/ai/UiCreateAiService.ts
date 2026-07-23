/**
 * ゲーム UI 作成 AI — 設計書一括生成サービス
 */
import type { AiProviderRouter } from './AiProviderRouter';
import type { ProjectMemoryService } from './ProjectMemoryService';
import type { LogService } from '../logs/LogService';
import type {
  UiColorPalette,
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
    private readonly ai: AiProviderRouter,
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

  async generate(input: UiCreateAiRequest): Promise<UiCreateAiResult> {
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

    const system = loadUiCreateSystemPrompt();
    const userParts = [
      memoryBlock,
      `【ユーザー入力】\n${prompt}`,
      `【推定ジャンル】\n${genre}`,
      `【適用テーマ】\n${theme.label} (${theme.id})\n${theme.description}\nフォント候補: ${theme.fontHints.join(', ')}`,
      `【カラーパレット（尊重すること。微調整する場合は理由を書く）】\n${formatPalette(theme.palette)}`,
      `【対象画面】\n${screen.label} (${screen.id})\n${screen.description}`,
      `【推奨コンポーネント】\n${screen.typicalComponents.join(', ')}`,
      `【推奨アイコン案】\n${screen.typicalIcons.join(', ')}`,
      `【向き】\n${orientation === 'portrait' ? '縦画面' : '横画面'}`,
      `【デバイス】\n${deviceTarget === 'phone' ? 'Androidスマホ' : deviceTarget === 'tablet' ? 'Androidタブレット' : 'Androidスマホ + タブレット'}`,
      `【実装ターゲット】\n${implementationTarget}`,
      includeReview
        ? '【追加】セクション⑪ UI改善AIレビューを必ず含めること。'
        : '【追加】セクション⑪は省略してよい。',
      '上記に基づき、必須セクション①〜⑩' +
        (includeReview ? '＋⑪' : '') +
        'を高品質に一括生成してください。',
    ].filter(Boolean);

    const provider = this.ai.requireOpenAi();
    try {
      let markdown = await provider.completeChat({
        model: this.ai.getModel(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userParts.join('\n\n') },
        ],
      });

      // レビューが薄い場合の補強パス（明示リクエスト時）
      if (includeReview && !/⑪|UI改善/.test(markdown)) {
        const review = await this.reviewMarkdown(markdown);
        markdown = `${markdown.trim()}\n\n---\n\n# ⑪ UI改善AIレビュー\n\n${review.trim()}\n`;
      }

      const result: UiCreateAiResult = {
        markdown: markdown.trim(),
        detectedGenre: genre,
        appliedThemeId: theme.id,
        appliedScreenId: screen.id,
        palette: theme.palette,
        generatedAt: new Date().toISOString(),
      };
      this.log.info('ui-create-ai', `生成完了 theme=${theme.id} screen=${screen.id}`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.error('ui-create-ai', message);
      throw error;
    }
  }

  async reviewMarkdown(markdown: string): Promise<string> {
    const provider = this.ai.requireOpenAi();
    return provider.completeChat({
      model: this.ai.getModel(),
      messages: [
        { role: 'system', content: loadUiCreateReviewPrompt() },
        { role: 'user', content: markdown.slice(0, 24000) },
      ],
    });
  }
}
