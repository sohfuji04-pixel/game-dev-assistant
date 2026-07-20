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
  autoUpdate: true,
  updateRetryCount: 3,
};
