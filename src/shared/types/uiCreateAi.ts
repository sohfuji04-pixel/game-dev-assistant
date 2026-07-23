/**
 * ゲーム UI 作成 AI — 共有型
 * 将来の画像生成 AI / Figma / デザインシステム連携を見据えた入出力契約。
 */

/** UI テーマテンプレート ID（追加しやすいよう string でも受け付ける） */
export type UiThemeId =
  | 'auto'
  | 'cute'
  | 'fantasy'
  | 'japanese'
  | 'sf'
  | 'pop'
  | 'dark'
  | 'nordic'
  | 'nintendo'
  | 'picturebook'
  | 'luxury';

/** 画面テンプレート ID */
export type UiScreenId =
  | 'home'
  | 'shop'
  | 'gacha'
  | 'settings'
  | 'encyclopedia'
  | 'event'
  | 'ranking'
  | 'result'
  | 'mission'
  | 'friend'
  | 'custom';

export type UiOrientation = 'portrait' | 'landscape';

export type UiDeviceTarget = 'phone' | 'tablet' | 'both';

/** テーマに紐づくカラーパレット */
export interface UiColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  warning: string;
  success: string;
}

/** テーマ定義（テンプレート切替用） */
export interface UiThemeDefinition {
  id: Exclude<UiThemeId, 'auto'>;
  label: string;
  description: string;
  keywords: string[];
  palette: UiColorPalette;
  fontHints: string[];
}

/** 画面テンプレート定義 */
export interface UiScreenDefinition {
  id: Exclude<UiScreenId, 'custom'>;
  label: string;
  description: string;
  typicalComponents: string[];
  typicalIcons: string[];
}

/** 生成リクエスト */
export interface UiCreateAiRequest {
  /** 自然言語入力（世界観・ジャンル・画面名を含む） */
  prompt: string;
  /** 明示的な画面指定（未指定なら prompt から推定） */
  screenId?: UiScreenId | null;
  /** テーマ（auto ならジャンルから推定） */
  themeId?: UiThemeId;
  orientation?: UiOrientation;
  deviceTarget?: UiDeviceTarget;
  /** Capacitor / HTML+CSS+TS など実装ターゲット */
  implementationTarget?: string;
  projectPath?: string | null;
  /** 生成後に自己レビューを含めるか */
  includeReview?: boolean;
}

/** 生成結果（Markdown 本文 + メタ） */
export interface UiCreateAiResult {
  markdown: string;
  detectedGenre: string;
  appliedThemeId: Exclude<UiThemeId, 'auto'> | string;
  appliedScreenId: UiScreenId | string;
  palette: UiColorPalette;
  generatedAt: string;
  /** chatgpt = ChatGPT Web 貼り付け / local = 下書き */
  source?: 'chatgpt' | 'openai' | 'paste';
}

/** ChatGPT（キー不要）向けに組み立てた依頼プロンプト一式 */
export interface UiCreateAiChatGptPack {
  /** chatgpt.com に貼る本文（system + user 結合） */
  chatGptPrompt: string;
  chatgptUrl: string;
  detectedGenre: string;
  appliedThemeId: Exclude<UiThemeId, 'auto'> | string;
  appliedScreenId: UiScreenId | string;
  palette: UiColorPalette;
  preparedAt: string;
  instructions: string;
}

/** 将来のデザインシステム / Figma 連携用の正規化メタ */
export interface UiDesignSystemExportHint {
  version: 1;
  themeId: string;
  screenId: string;
  palette: UiColorPalette;
  assetManifestPath: string;
  componentRoot: string;
}
