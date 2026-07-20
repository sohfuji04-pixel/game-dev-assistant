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
  SETTINGS_SET_OPENAI_KEY: 'settings:set-openai-key',
  SETTINGS_GET_OPENAI_KEY_MASK: 'settings:get-openai-key-mask',

  // ChatGPT
  CHAT_THREADS: 'chat:threads',
  CHAT_MESSAGES: 'chat:messages',
  CHAT_CREATE: 'chat:create',
  CHAT_DELETE: 'chat:delete',
  CHAT_SET_MODE: 'chat:set-mode',
  CHAT_SEND: 'chat:send',
  CHAT_STOP: 'chat:stop',
  CHAT_REGENERATE: 'chat:regenerate',
  CHAT_STREAM: 'chat:stream',

  // Prompt Builder
  PROMPT_BUILD: 'prompt:build',
  CURSOR_SEND_PROMPT: 'cursor:send-prompt',

  // Project Memory
  MEMORY_GET: 'memory:get',
  MEMORY_SAVE: 'memory:save',

  // プロジェクト
  PROJECT_OPEN: 'project:open',
  PROJECT_RECENT: 'project:recent',
  PROJECT_REMOVE_RECENT: 'project:remove-recent',

  // Cursor 連携
  CURSOR_LAUNCH: 'cursor:launch',
  CURSOR_OPEN_FOLDER: 'cursor:open-folder',
  CURSOR_CHECK: 'cursor:check',
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
  GIT_CHECK: 'git:check',
  GIT_COMMIT: 'git:commit',
  GIT_PUSH: 'git:push',
  GIT_PULL: 'git:pull',
  GIT_BRANCHES: 'git:branches',
  GIT_CHECKOUT: 'git:checkout',
  GIT_CREATE_BRANCH: 'git:create-branch',
  GIT_RELEASE: 'git:release',

  // 外部ツール接続確認（Git + Cursor）
  TOOLS_CHECK_CONNECTIONS: 'tools:check-connections',

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
  HUB_SHOW_TOOL_VIEW: 'hub:show-tool-view',
  HUB_HIDE_TOOL_VIEW: 'hub:hide-tool-view',
  HUB_SET_TOOL_BOUNDS: 'hub:set-tool-bounds',
  HUB_RELOAD_TOOL_VIEW: 'hub:reload-tool-view',
  HUB_SERVER_STATUS: 'hub:server-status',
  HUB_SERVER_START: 'hub:server-start',
  HUB_SERVER_STOP: 'hub:server-stop',
  HUB_RUN_SCRIPT: 'hub:run-script',
  HUB_OPEN_EXTERNAL: 'hub:open-external',
  PROJECT_REVEAL: 'project:reveal',

  // Blender AI
  BLENDER_STATUS: 'blender:status',
  BLENDER_CONNECT: 'blender:connect',
  BLENDER_DISCONNECT: 'blender:disconnect',
  BLENDER_LAUNCH: 'blender:launch',
  BLENDER_CHECK_EXE: 'blender:check-exe',
  BLENDER_EXECUTE: 'blender:execute',
  BLENDER_CHAT_SEND: 'blender:chat-send',
  BLENDER_CHAT_CANCEL: 'blender:chat-cancel',
  BLENDER_CHAT_RERUN: 'blender:chat-rerun',
  BLENDER_CHAT_HISTORY: 'blender:chat-history',
  BLENDER_CHAT_CLEAR: 'blender:chat-clear',
  BLENDER_CHAT_PROGRESS: 'blender:chat-progress',
  BLENDER_CONNECTION_CHANGED: 'blender:connection-changed',
  BLENDER_TEMPLATES_LIST: 'blender:templates-list',
  BLENDER_TEMPLATES_RUN: 'blender:templates-run',
  BLENDER_PREVIEW: 'blender:preview',
  BLENDER_GENERATE_FROM_PHOTO: 'blender:generate-from-photo',

  // Unity AI
  UNITY_STATUS: 'unity:status',
  UNITY_CONNECT: 'unity:connect',
  UNITY_DISCONNECT: 'unity:disconnect',
  UNITY_EXECUTE: 'unity:execute',
  UNITY_CHAT_SEND: 'unity:chat-send',
  UNITY_CHAT_HISTORY: 'unity:chat-history',
  UNITY_CHAT_CLEAR: 'unity:chat-clear',
  UNITY_CHAT_PROGRESS: 'unity:chat-progress',
  UNITY_CONNECTION_CHANGED: 'unity:connection-changed',
  UNITY_QUICK_COMMANDS: 'unity:quick-commands',
  UNITY_PACKAGE_PATH: 'unity:package-path',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
