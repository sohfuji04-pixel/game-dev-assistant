/**
 * レンダラー側 IPC クライアント（Model 層）
 * ViewModel はこのクラス経由でのみメインプロセスと通信する。
 */
import { IpcChannels } from '@shared/ipcChannels';
import type {
  AppPaths,
  AppSettings,
  AssetItem,
  AssetType,
  BuildResult,
  ChangelogEntry,
  CreatorTool,
  DevServerStatus,
  GitBranchInfo,
  GitStatusInfo,
  HubScanResult,
  LogEntry,
  PluginManifest,
  PromptHistoryItem,
  PromptItem,
  RecentProject,
  ScriptRunResult,
  ToolConnectionStatus,
  ToolsConnectionSnapshot,
  UpdaterStatus,
  WatcherEvent,
  BlenderConnectionStatus,
  BlenderChatMessage,
  BlenderTemplateInfo,
  UnityConnectionStatus,
  UnityChatMessage,
  UnityQuickCommand,
} from '@shared/types';

function api() {
  if (!window.electronAPI) {
    throw new Error(
      'electronAPI が利用できません。デスクトップのショートカット、または release/win-unpacked の exe から起動してください（ブラウザでは動きません）。',
    );
  }
  return window.electronAPI;
}

export const ApiClient = {
  getVersion: () => api().invoke<string>(IpcChannels.APP_GET_VERSION),
  getPaths: () => api().invoke<AppPaths>(IpcChannels.APP_GET_PATHS),

  getSettings: () => api().invoke<AppSettings>(IpcChannels.SETTINGS_GET),
  setSettings: (partial: Partial<AppSettings>) =>
    api().invoke<AppSettings>(IpcChannels.SETTINGS_SET, partial),
  selectPath: (options?: {
    title?: string;
    directory?: boolean;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => api().invoke<string | null>(IpcChannels.SETTINGS_SELECT_PATH, options),

  listRecentProjects: () => api().invoke<RecentProject[]>(IpcChannels.PROJECT_RECENT),
  openProject: (projectPath?: string) =>
    api().invoke<RecentProject | null>(IpcChannels.PROJECT_OPEN, projectPath),
  removeRecentProject: (id: string) => api().invoke<void>(IpcChannels.PROJECT_REMOVE_RECENT, id),
  listChangelog: () => api().invoke<ChangelogEntry[]>(IpcChannels.CHANGELOG_LIST),

  launchCursor: (folder?: string) =>
    api().invoke<{ success: boolean; message: string }>(IpcChannels.CURSOR_LAUNCH, folder),
  openFolderInCursor: () =>
    api().invoke<{ success: boolean; message: string }>(IpcChannels.CURSOR_OPEN_FOLDER),
  checkCursorConnection: () =>
    api().invoke<ToolConnectionStatus>(IpcChannels.CURSOR_CHECK),
  checkGitConnection: () => api().invoke<ToolConnectionStatus>(IpcChannels.GIT_CHECK),
  checkToolsConnections: () =>
    api().invoke<ToolsConnectionSnapshot>(IpcChannels.TOOLS_CHECK_CONNECTIONS),
  listPrompts: () => api().invoke<PromptItem[]>(IpcChannels.PROMPT_LIST),
  savePrompt: (input: { id?: string; title: string; content: string; tags?: string[] }) =>
    api().invoke<PromptItem>(IpcChannels.PROMPT_SAVE, input),
  deletePrompt: (id: string) => api().invoke<void>(IpcChannels.PROMPT_DELETE, id),
  searchPrompts: (query: string) => api().invoke<PromptItem[]>(IpcChannels.PROMPT_SEARCH, query),
  listPromptHistory: (limit?: number) =>
    api().invoke<PromptHistoryItem[]>(IpcChannels.PROMPT_HISTORY, limit),
  addPromptHistory: (input: { promptId?: string | null; title: string; content: string }) =>
    api().invoke<PromptHistoryItem>(IpcChannels.PROMPT_ADD_HISTORY, input),

  startWatcher: (root: string) =>
    api().invoke<{ success: boolean; message: string }>(IpcChannels.WATCHER_START, root),
  stopWatcher: () => api().invoke<{ success: boolean }>(IpcChannels.WATCHER_STOP),
  onWatcherEvent: (listener: (event: WatcherEvent) => void) =>
    api().on(IpcChannels.WATCHER_EVENT, (...args) => listener(args[0] as WatcherEvent)),

  gitStatus: (cwd: string) => api().invoke<GitStatusInfo>(IpcChannels.GIT_STATUS, cwd),
  gitCommit: (cwd: string, message: string, files?: string[]) =>
    api().invoke<string>(IpcChannels.GIT_COMMIT, cwd, message, files),
  gitPush: (cwd: string) => api().invoke<string>(IpcChannels.GIT_PUSH, cwd),
  gitPull: (cwd: string) => api().invoke<string>(IpcChannels.GIT_PULL, cwd),
  gitBranches: (cwd: string) => api().invoke<GitBranchInfo>(IpcChannels.GIT_BRANCHES, cwd),
  gitCheckout: (cwd: string, branch: string) =>
    api().invoke<void>(IpcChannels.GIT_CHECKOUT, cwd, branch),
  gitCreateBranch: (cwd: string, branch: string, checkout?: boolean) =>
    api().invoke<void>(IpcChannels.GIT_CREATE_BRANCH, cwd, branch, checkout),
  gitRelease: (cwd: string, version: string, message?: string) =>
    api().invoke<string>(IpcChannels.GIT_RELEASE, cwd, version, message),

  buildWindows: (projectPath: string) =>
    api().invoke<BuildResult>(IpcChannels.BUILD_WINDOWS, projectPath),
  buildAndroid: (projectPath: string) =>
    api().invoke<BuildResult>(IpcChannels.BUILD_ANDROID, projectPath),

  checkUpdate: () => api().invoke<UpdaterStatus>(IpcChannels.UPDATER_CHECK),
  downloadUpdate: () => api().invoke<UpdaterStatus>(IpcChannels.UPDATER_DOWNLOAD),
  installUpdate: () => api().invoke<void>(IpcChannels.UPDATER_INSTALL),
  getUpdaterStatus: () => api().invoke<UpdaterStatus>(IpcChannels.UPDATER_STATUS),
  onUpdaterStatus: (listener: (status: UpdaterStatus) => void) =>
    api().on(IpcChannels.UPDATER_STATUS, (...args) => listener(args[0] as UpdaterStatus)),

  listAssets: (type?: AssetType) => api().invoke<AssetItem[]>(IpcChannels.ASSETS_LIST, type),
  importAssets: (filePaths?: string[], type?: AssetType) =>
    api().invoke<AssetItem[]>(IpcChannels.ASSETS_IMPORT, filePaths, type),
  deleteAsset: (id: string) => api().invoke<void>(IpcChannels.ASSETS_DELETE, id),
  openAssetsFolder: () => api().invoke<void>(IpcChannels.ASSETS_OPEN_FOLDER),

  listLogs: (limit?: number) => api().invoke<LogEntry[]>(IpcChannels.LOG_LIST, limit),
  clearLogs: () => api().invoke<void>(IpcChannels.LOG_CLEAR),
  appendLog: (payload: {
    level: LogEntry['level'];
    category: string;
    message: string;
    detail?: string;
  }) => api().invoke<LogEntry>(IpcChannels.LOG_APPEND, payload),

  listPlugins: () => api().invoke<PluginManifest[]>(IpcChannels.PLUGIN_LIST),
  invokePlugin: (pluginId: string, command: string, payload?: unknown) =>
    api().invoke<unknown>(IpcChannels.PLUGIN_INVOKE, pluginId, command, payload),

  hubScan: (projectRoot: string) => api().invoke<HubScanResult>(IpcChannels.HUB_SCAN, projectRoot),
  hubOpenTool: (projectRoot: string, htmlPath: string) =>
    api().invoke<{ success: boolean; url: string; message: string }>(
      IpcChannels.HUB_OPEN_TOOL,
      projectRoot,
      htmlPath,
    ),
  hubOpenHub: (projectRoot: string) =>
    api().invoke<{ success: boolean; url: string; message: string }>(
      IpcChannels.HUB_OPEN_HUB,
      projectRoot,
    ),
  hubServerStatus: () => api().invoke<DevServerStatus>(IpcChannels.HUB_SERVER_STATUS),
  hubServerStart: (projectRoot: string, port?: number) =>
    api().invoke<DevServerStatus>(IpcChannels.HUB_SERVER_START, projectRoot, port),
  hubServerStop: () => api().invoke<DevServerStatus>(IpcChannels.HUB_SERVER_STOP),
  hubRunScript: (cwd: string, script: string) =>
    api().invoke<ScriptRunResult>(IpcChannels.HUB_RUN_SCRIPT, cwd, script),
  hubOpenExternal: (url: string) => api().invoke<void>(IpcChannels.HUB_OPEN_EXTERNAL, url),
  revealInFolder: (targetPath: string) => api().invoke<void>(IpcChannels.PROJECT_REVEAL, targetPath),

  blenderStatus: () => api().invoke<BlenderConnectionStatus>(IpcChannels.BLENDER_STATUS),
  blenderConnect: () => api().invoke<BlenderConnectionStatus>(IpcChannels.BLENDER_CONNECT),
  blenderDisconnect: () => api().invoke<void>(IpcChannels.BLENDER_DISCONNECT),
  blenderLaunch: () =>
    api().invoke<{ ok: boolean; message: string }>(IpcChannels.BLENDER_LAUNCH),
  blenderCheckExe: () =>
    api().invoke<{ ok: boolean; path: string; message: string }>(IpcChannels.BLENDER_CHECK_EXE),
  blenderExecute: (method: string, params?: Record<string, unknown>) =>
    api().invoke<unknown>(IpcChannels.BLENDER_EXECUTE, method, params),
  blenderChatSend: (content: string) =>
    api().invoke<BlenderChatMessage>(IpcChannels.BLENDER_CHAT_SEND, content),
  blenderChatCancel: (messageId: string) =>
    api().invoke<void>(IpcChannels.BLENDER_CHAT_CANCEL, messageId),
  blenderChatRerun: (messageId: string) =>
    api().invoke<BlenderChatMessage>(IpcChannels.BLENDER_CHAT_RERUN, messageId),
  blenderChatHistory: () =>
    api().invoke<BlenderChatMessage[]>(IpcChannels.BLENDER_CHAT_HISTORY),
  blenderChatClear: () => api().invoke<boolean>(IpcChannels.BLENDER_CHAT_CLEAR),
  blenderTemplatesList: () =>
    api().invoke<BlenderTemplateInfo[]>(IpcChannels.BLENDER_TEMPLATES_LIST),
  blenderTemplatesRun: (id: string) =>
    api().invoke<BlenderChatMessage>(IpcChannels.BLENDER_TEMPLATES_RUN, id),
  onBlenderConnectionChanged: (listener: (status: BlenderConnectionStatus) => void) =>
    api().on(IpcChannels.BLENDER_CONNECTION_CHANGED, (...args) =>
      listener(args[0] as BlenderConnectionStatus),
    ),
  onBlenderChatProgress: (listener: (msg: BlenderChatMessage) => void) =>
    api().on(IpcChannels.BLENDER_CHAT_PROGRESS, (...args) =>
      listener(args[0] as BlenderChatMessage),
    ),

  unityStatus: () => api().invoke<UnityConnectionStatus>(IpcChannels.UNITY_STATUS),
  unityConnect: () => api().invoke<UnityConnectionStatus>(IpcChannels.UNITY_CONNECT),
  unityDisconnect: () => api().invoke<void>(IpcChannels.UNITY_DISCONNECT),
  unityExecute: (method: string, params?: Record<string, unknown>) =>
    api().invoke<unknown>(IpcChannels.UNITY_EXECUTE, method, params),
  unityChatSend: (content: string) =>
    api().invoke<UnityChatMessage>(IpcChannels.UNITY_CHAT_SEND, content),
  unityChatHistory: () => api().invoke<UnityChatMessage[]>(IpcChannels.UNITY_CHAT_HISTORY),
  unityChatClear: () => api().invoke<boolean>(IpcChannels.UNITY_CHAT_CLEAR),
  unityQuickCommands: () =>
    api().invoke<UnityQuickCommand[]>(IpcChannels.UNITY_QUICK_COMMANDS),
  unityPackagePath: () => api().invoke<string>(IpcChannels.UNITY_PACKAGE_PATH),
  onUnityConnectionChanged: (listener: (status: UnityConnectionStatus) => void) =>
    api().on(IpcChannels.UNITY_CONNECTION_CHANGED, (...args) =>
      listener(args[0] as UnityConnectionStatus),
    ),
  onUnityChatProgress: (listener: (msg: UnityChatMessage) => void) =>
    api().on(IpcChannels.UNITY_CHAT_PROGRESS, (...args) =>
      listener(args[0] as UnityChatMessage),
    ),
};

export type { CreatorTool };
