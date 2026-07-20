/**
 * IPC ハンドラ登録
 * レンダラーの ViewModel から呼び出される Model 層の窓口。
 */
import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import path from 'node:path';
import { IpcChannels } from '../../shared/ipcChannels';
import type { AppSettings, AssetType } from '../../shared/types';
import type { AppServices } from '../main';
import { AssetService } from '../services/AssetService';
import { BuildService } from '../services/BuildService';
import { CursorService } from '../services/CursorService';
import { CreatorHubService } from '../services/CreatorHubService';
import { GitService } from '../services/GitService';
import { ProjectService } from '../services/ProjectService';
import { ToolRunnerService } from '../services/ToolRunnerService';

type GetWindow = () => BrowserWindow | null;

export function registerIpcHandlers(services: AppServices, getWindow: GetWindow): void {
  const { db, log, settings, watcher, updater, plugins, devServer } = services;
  const projects = new ProjectService(db, log, watcher);
  const cursor = new CursorService(db, settings, log);
  const git = new GitService(settings, log);
  const assets = new AssetService(db, settings, log);
  const build = new BuildService(settings, log);
  const hub = new CreatorHubService(devServer, log);
  const runner = new ToolRunnerService(log);

  // --- App ---
  ipcMain.handle(IpcChannels.APP_GET_VERSION, () => app.getVersion());
  ipcMain.handle(IpcChannels.APP_GET_PATHS, () => {
    const data = settings.get().dataPath;
    return {
      userData: app.getPath('userData'),
      assets: path.join(data, 'assets'),
      logs: path.join(app.getPath('userData'), 'logs'),
      database: path.join(app.getPath('userData'), 'gda.db'),
    };
  });

  // --- Settings ---
  ipcMain.handle(IpcChannels.SETTINGS_GET, () => settings.get());
  ipcMain.handle(IpcChannels.SETTINGS_SET, (_e, partial: Partial<AppSettings>) => {
    const next = settings.set(partial);
    log.info('settings', '設定を更新しました');
    return next;
  });
  ipcMain.handle(
    IpcChannels.SETTINGS_SELECT_PATH,
    async (_e, options: { title?: string; filters?: Electron.FileFilter[]; directory?: boolean }) => {
      const win = getWindow();
      const result = await dialog.showOpenDialog(win ?? undefined!, {
        title: options?.title ?? 'パスを選択',
        properties: options?.directory ? ['openDirectory'] : ['openFile'],
        filters: options?.filters,
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    },
  );

  // --- Projects ---
  ipcMain.handle(IpcChannels.PROJECT_RECENT, () => projects.listRecent());
  ipcMain.handle(IpcChannels.PROJECT_OPEN, async (_e, projectPath?: string) => {
    let target = projectPath;
    if (!target) {
      const win = getWindow();
      const result = await dialog.showOpenDialog(win ?? undefined!, {
        title: 'プロジェクトフォルダを選択',
        properties: ['openDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      target = result.filePaths[0];
    }
    return projects.open(target);
  });
  ipcMain.handle(IpcChannels.PROJECT_REMOVE_RECENT, (_e, id: string) => {
    projects.removeRecent(id);
  });
  ipcMain.handle(IpcChannels.CHANGELOG_LIST, () => projects.listChangelog());

  // --- Cursor / Prompt ---
  ipcMain.handle(IpcChannels.CURSOR_LAUNCH, (_e, folder?: string) => cursor.launch(folder));
  ipcMain.handle(IpcChannels.CURSOR_OPEN_FOLDER, async () => {
    const win = getWindow();
    const result = await dialog.showOpenDialog(win ?? undefined!, {
      title: 'Cursor で開くフォルダ',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: 'キャンセルされました' };
    }
    return cursor.launch(result.filePaths[0]);
  });
  ipcMain.handle(IpcChannels.PROMPT_LIST, () => cursor.listPrompts());
  ipcMain.handle(IpcChannels.PROMPT_SAVE, (_e, input) => cursor.savePrompt(input));
  ipcMain.handle(IpcChannels.PROMPT_DELETE, (_e, id: string) => cursor.deletePrompt(id));
  ipcMain.handle(IpcChannels.PROMPT_SEARCH, (_e, query: string) => cursor.searchPrompts(query));
  ipcMain.handle(IpcChannels.PROMPT_HISTORY, (_e, limit?: number) => cursor.listHistory(limit));
  ipcMain.handle(IpcChannels.PROMPT_ADD_HISTORY, (_e, input) => cursor.addHistory(input));

  // --- Watcher ---
  ipcMain.handle(IpcChannels.WATCHER_START, (_e, root: string) => watcher.start(root));
  ipcMain.handle(IpcChannels.WATCHER_STOP, () => {
    watcher.stop();
    return { success: true };
  });

  // --- Git ---
  ipcMain.handle(IpcChannels.GIT_STATUS, (_e, cwd: string) => git.status(cwd));
  ipcMain.handle(IpcChannels.GIT_COMMIT, (_e, cwd: string, message: string, files?: string[]) =>
    git.commit(cwd, message, files),
  );
  ipcMain.handle(IpcChannels.GIT_PUSH, (_e, cwd: string) => git.push(cwd));
  ipcMain.handle(IpcChannels.GIT_PULL, (_e, cwd: string) => git.pull(cwd));
  ipcMain.handle(IpcChannels.GIT_BRANCHES, (_e, cwd: string) => git.branches(cwd));
  ipcMain.handle(IpcChannels.GIT_CHECKOUT, (_e, cwd: string, branch: string) =>
    git.checkout(cwd, branch),
  );
  ipcMain.handle(IpcChannels.GIT_CREATE_BRANCH, (_e, cwd: string, branch: string, checkout?: boolean) =>
    git.createBranch(cwd, branch, checkout),
  );
  ipcMain.handle(IpcChannels.GIT_RELEASE, (_e, cwd: string, version: string, message?: string) =>
    git.release(cwd, version, message),
  );

  // --- Build ---
  ipcMain.handle(IpcChannels.BUILD_WINDOWS, (_e, projectPath: string) =>
    build.buildWindows(projectPath),
  );
  ipcMain.handle(IpcChannels.BUILD_ANDROID, (_e, projectPath: string) =>
    build.buildAndroid(projectPath),
  );

  // --- Updater ---
  ipcMain.handle(IpcChannels.UPDATER_CHECK, () => updater.checkForUpdates());
  ipcMain.handle(IpcChannels.UPDATER_DOWNLOAD, () => updater.downloadUpdate());
  ipcMain.handle(IpcChannels.UPDATER_INSTALL, () => {
    updater.quitAndInstall();
  });
  ipcMain.handle(IpcChannels.UPDATER_STATUS, () => updater.getStatus());

  // --- Assets ---
  ipcMain.handle(IpcChannels.ASSETS_LIST, (_e, type?: AssetType) => assets.list(type));
  ipcMain.handle(IpcChannels.ASSETS_IMPORT, async (_e, filePaths: string[], type?: AssetType) => {
    if (!filePaths?.length) {
      const win = getWindow();
      const result = await dialog.showOpenDialog(win ?? undefined!, {
        title: 'アセットを選択',
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Media', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp3', 'wav', 'ogg'] },
          { name: 'All', extensions: ['*'] },
        ],
      });
      if (result.canceled) return [];
      filePaths = result.filePaths;
    }
    return assets.importFiles(filePaths, type);
  });
  ipcMain.handle(IpcChannels.ASSETS_DELETE, (_e, id: string) => assets.delete(id));
  ipcMain.handle(IpcChannels.ASSETS_OPEN_FOLDER, async () => {
    await shell.openPath(settings.getAssetsRoot());
  });

  // --- Logs ---
  ipcMain.handle(IpcChannels.LOG_LIST, (_e, limit?: number) => log.list(limit));
  ipcMain.handle(IpcChannels.LOG_CLEAR, () => {
    log.clear();
    log.info('log', 'ログをクリアしました');
  });
  ipcMain.handle(
    IpcChannels.LOG_APPEND,
    (_e, payload: { level: 'info' | 'warn' | 'error' | 'debug'; category: string; message: string; detail?: string }) => {
      const fn = log[payload.level].bind(log);
      return fn(payload.category, payload.message, payload.detail);
    },
  );

  // --- Plugins ---
  ipcMain.handle(IpcChannels.PLUGIN_LIST, () => plugins.list());
  ipcMain.handle(IpcChannels.PLUGIN_INVOKE, (_e, pluginId: string, command: string, payload?: unknown) =>
    plugins.invoke(pluginId, command, payload),
  );

  // --- Creator Hub ---
  ipcMain.handle(IpcChannels.HUB_SCAN, (_e, projectRoot: string) => hub.scan(projectRoot));
  ipcMain.handle(IpcChannels.HUB_OPEN_TOOL, (_e, projectRoot: string, htmlPath: string) =>
    hub.resolveToolUrl(projectRoot, htmlPath),
  );
  ipcMain.handle(IpcChannels.HUB_OPEN_HUB, (_e, projectRoot: string) => hub.openHub(projectRoot));
  ipcMain.handle(IpcChannels.HUB_SERVER_STATUS, () => devServer.getStatus());
  ipcMain.handle(IpcChannels.HUB_SERVER_START, (_e, projectRoot: string, port?: number) =>
    hub.ensureServer(projectRoot, port),
  );
  ipcMain.handle(IpcChannels.HUB_SERVER_STOP, () => hub.stopServer());
  ipcMain.handle(IpcChannels.HUB_RUN_SCRIPT, (_e, cwd: string, script: string) =>
    runner.runNpmScript(cwd, script),
  );
  ipcMain.handle(IpcChannels.PROJECT_REVEAL, async (_e, targetPath: string) => {
    await shell.showItemInFolder(targetPath);
  });
  ipcMain.handle(IpcChannels.HUB_OPEN_EXTERNAL, async (_e, url: string) => {
    await hub.openInExternalBrowser(url);
  });
}
