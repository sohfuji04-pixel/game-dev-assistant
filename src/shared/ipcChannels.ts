/**
 * IPC チャンネル定義（メイン ↔ レンダラー）
 * 型安全な通信のため、チャンネル名はここでのみ定義する。
 */
export const IpcChannels = {
  // アプリ全般
  APP_GET_VERSION: 'app:get-version',
  APP_GET_PATHS: 'app:get-paths',

  // 設定
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_SELECT_PATH: 'settings:select-path',

  // プロジェクト
  PROJECT_OPEN: 'project:open',
  PROJECT_RECENT: 'project:recent',
  PROJECT_REMOVE_RECENT: 'project:remove-recent',

  // Cursor 連携
  CURSOR_LAUNCH: 'cursor:launch',
  CURSOR_OPEN_FOLDER: 'cursor:open-folder',
  PROMPT_LIST: 'prompt:list',
  PROMPT_SAVE: 'prompt:save',
  PROMPT_DELETE: 'prompt:delete',
  PROMPT_SEARCH: 'prompt:search',
  PROMPT_HISTORY: 'prompt:history',
  PROMPT_ADD_HISTORY: 'prompt:add-history',

  // ファイル監視
  WATCHER_START: 'watcher:start',
  WATCHER_STOP: 'watcher:stop',
  WATCHER_EVENT: 'watcher:event',

  // Git
  GIT_STATUS: 'git:status',
  GIT_COMMIT: 'git:commit',
  GIT_PUSH: 'git:push',
  GIT_PULL: 'git:pull',
  GIT_BRANCHES: 'git:branches',
  GIT_CHECKOUT: 'git:checkout',
  GIT_CREATE_BRANCH: 'git:create-branch',
  GIT_RELEASE: 'git:release',

  // ビルド
  BUILD_WINDOWS: 'build:windows',
  BUILD_ANDROID: 'build:android',
  BUILD_LOG: 'build:log',

  // 自動更新
  UPDATER_CHECK: 'updater:check',
  UPDATER_DOWNLOAD: 'updater:download',
  UPDATER_INSTALL: 'updater:install',
  UPDATER_STATUS: 'updater:status',

  // Assets
  ASSETS_LIST: 'assets:list',
  ASSETS_IMPORT: 'assets:import',
  ASSETS_DELETE: 'assets:delete',
  ASSETS_OPEN_FOLDER: 'assets:open-folder',

  // ログ
  LOG_LIST: 'log:list',
  LOG_CLEAR: 'log:clear',
  LOG_APPEND: 'log:append',

  // 更新履歴（アプリの changelog）
  CHANGELOG_LIST: 'changelog:list',

  // プラグイン
  PLUGIN_LIST: 'plugin:list',
  PLUGIN_INVOKE: 'plugin:invoke',

  // 創作ツールハブ
  HUB_SCAN: 'hub:scan',
  HUB_OPEN_TOOL: 'hub:open-tool',
  HUB_OPEN_HUB: 'hub:open-hub',
  HUB_SERVER_STATUS: 'hub:server-status',
  HUB_SERVER_START: 'hub:server-start',
  HUB_SERVER_STOP: 'hub:server-stop',
  HUB_RUN_SCRIPT: 'hub:run-script',
  HUB_OPEN_EXTERNAL: 'hub:open-external',
  PROJECT_REVEAL: 'project:reveal',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
