/**
 * ユーザー設定の型・デフォルト（共有）
 * アップデートしても userData 内に保持される。
 */
export type AppTheme = 'light' | 'dark' | 'system';

/** 更新チャネル */
export type UpdateChannel = 'latest' | 'beta' | 'alpha';

/** ユーザー設定 */
export interface AppSettings {
  theme: AppTheme;
  /** データ保存先ディレクトリ（userData 配下推奨） */
  dataPath: string;
  /** Cursor.exe のフルパス */
  cursorExePath: string;
  /** git 実行ファイルパス */
  gitPath: string;
  /** Android SDK パス */
  androidSdkPath: string;
  /** 既定のプロジェクトルート */
  defaultProjectPath: string;
  /** GitHub Releases owner */
  updateOwner: string;
  /** GitHub Releases repo */
  updateRepo: string;
  /** 更新チャネル */
  updateChannel: UpdateChannel;
  /** 起動時の自動更新チェック */
  autoUpdate: boolean;
  /** 更新失敗時の自動再試行回数 */
  updateRetryCount: number;
  /** Blender.exe のフルパス */
  blenderExePath: string;
  /** Blender ブリッジホスト */
  blenderHost: string;
  /** Blender ブリッジポート */
  blenderPort: number;
  /** Blender 切断時の自動再接続 */
  autoReconnectBlender: boolean;
  /** OpenAI API キー（Blender AI 用・任意） */
  openaiApiKey: string;
  /** OpenAI モデル名 */
  openaiModel: string;
  /** Unity Editor ブリッジ URL（例: ws://127.0.0.1:8765/unity/） */
  unityWsUrl: string;
  /** Unity Editor.exe パス（任意・案内用） */
  unityEditorPath: string;
  /** 既定の Unity プロジェクトパス */
  unityProjectPath: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  dataPath: '',
  cursorExePath: '',
  gitPath: 'git',
  androidSdkPath: '',
  defaultProjectPath: '',
  updateOwner: 'sohfuji04-pixel',
  updateRepo: 'game-dev-assistant',
  updateChannel: 'latest',
  autoUpdate: false,
  updateRetryCount: 1,
  blenderExePath: '',
  blenderHost: '127.0.0.1',
  blenderPort: 8775,
  autoReconnectBlender: true,
  openaiApiKey: '',
  openaiModel: 'gpt-4.1',
  unityWsUrl: 'ws://127.0.0.1:8765/unity/',
  unityEditorPath: '',
  unityProjectPath: '',
};
