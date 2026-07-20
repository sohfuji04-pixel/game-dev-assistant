/**
 * メイン / レンダラー共有の型定義
 */

export type {
  AppTheme,
  UpdateChannel,
  AppSettings,
} from './settings';
export { DEFAULT_SETTINGS } from './settings';

export type {
  BlenderConnectionStatus,
  BlenderChatMessage,
  BlenderToolCall,
  BlenderTemplateInfo,
} from './blender';

export type {
  UnityConnectionStatus,
  UnityChatMessage,
  UnityQuickCommand,
} from './unity';

/** 最近開いたプロジェクト */
export interface RecentProject {
  id: string;
  name: string;
  path: string;
  lastOpenedAt: string;
}

/** Prompt テンプレート */
export interface PromptItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** Prompt 利用履歴 */
export interface PromptHistoryItem {
  id: string;
  promptId: string | null;
  title: string;
  content: string;
  usedAt: string;
}

/** ファイル監視イベント */
export interface WatcherEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
  extension: string;
  timestamp: string;
}

/** Git ステータス */
export interface GitStatusInfo {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicted: string[];
  isRepo: boolean;
}

/** Git ブランチ情報 */
export interface GitBranchInfo {
  current: string;
  all: string[];
}

/** アセット種別 */
export type AssetType = 'image' | 'bgm' | 'se' | 'other';

/** アセットメタデータ */
export interface AssetItem {
  id: string;
  name: string;
  path: string;
  type: AssetType;
  size: number;
  mimeType: string;
  thumbnailDataUrl?: string;
  createdAt: string;
}

/** 操作ログ */
export interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: string;
  message: string;
  detail?: string;
  createdAt: string;
}

/** アプリ更新履歴（changelog） */
export interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  body: string;
  releasedAt: string;
}

/** 自動更新ステータス */
export interface UpdaterStatus {
  status:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error';
  version?: string;
  progress?: number;
  message?: string;
}

/** ビルド結果 */
export interface BuildResult {
  success: boolean;
  message: string;
  log: string;
}

/** Git / Cursor などの外部ツール接続状態 */
export interface ToolConnectionStatus {
  ok: boolean;
  tool: 'cursor' | 'git';
  /** 解決済みパス（またはコマンド名） */
  path: string;
  /** 取得できた場合のバージョン文字列 */
  version?: string;
  message: string;
  checkedAt: string;
}

/** 接続状態の一括結果 */
export interface ToolsConnectionSnapshot {
  cursor: ToolConnectionStatus;
  git: ToolConnectionStatus;
}

/** プラグイン定義 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
}

/** 創作ツール（ハブカード） */
export interface CreatorTool {
  id: string;
  kicker: string;
  title: string;
  description: string;
  htmlPath: string;
  npmScript?: string;
  tone: string;
  chips: string[];
}

/** 創作パイプライン（npm script） */
export interface CreatorPipelineScript {
  id: string;
  label: string;
  npmScript: string;
  description: string;
}

/** ハブスキャン結果 */
export interface HubScanResult {
  projectRoot: string;
  kind: 'pokopoko' | 'generic' | 'npm-only' | 'none';
  hubHtml: string | null;
  tools: CreatorTool[];
  pipelines: CreatorPipelineScript[];
  packageScripts: string[];
  gameIndex: string | null;
  previewPages: Array<{ label: string; path: string }>;
}

/** npm script 実行結果 */
export interface ScriptRunResult {
  success: boolean;
  script: string;
  message: string;
  log: string;
}

/** 開発サーバ状態 */
export interface DevServerStatus {
  running: boolean;
  port: number;
  root: string | null;
  baseUrl: string | null;
  mode: 'builtin' | 'script' | 'idle';
}

/** アプリパス情報 */
export interface AppPaths {
  userData: string;
  assets: string;
  logs: string;
  database: string;
}

/** Preload 経由で公開する API 面 */
export interface ElectronAPI {
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>;
  on(channel: string, listener: (...args: unknown[]) => void): () => void;
}
