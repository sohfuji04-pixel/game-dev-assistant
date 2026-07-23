/**
 * IPC ハンドラ登録
 * レンダラーの ViewModel から呼び出される Model 層の窓口。
 */
import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { IpcChannels } from '../../shared/ipcChannels';
import type { AppSettings, AssetType, AiChatMode, UiCreateAiRequest } from '../../shared/types';
import { GAME_TEMPLATES } from '../../shared/blender/templates';
import { UNITY_QUICK_COMMANDS } from '../../shared/unity/unityMethods';
import type { AppServices } from '../main';
import { SECRET_OPENAI_KEY } from '../security/SecretStore';
import { AssetService } from '../services/AssetService';
import { BuildService } from '../services/BuildService';
import { CursorService } from '../services/CursorService';
import { CreatorHubService } from '../services/CreatorHubService';
import { GitService } from '../services/GitService';
import { ProjectService } from '../services/ProjectService';
import { ToolRunnerService } from '../services/ToolRunnerService';

type GetWindow = () => BrowserWindow | null;

export function registerIpcHandlers(services: AppServices, getWindow: GetWindow): void {
  const {
    db,
    log,
    settings,
    secrets,
    chatGpt,
    promptBuilder,
    uiCreateAi,
    projectMemory,
    watcher,
    updater,
    plugins,
    devServer,
    projectFiles,
    toolWorkspace,
    blender,
    blenderChat,
    unity,
    unityChat,
  } = services;
  const projects = new ProjectService(db, log, watcher);
  const cursor = new CursorService(db, settings, log);
  const git = new GitService(settings, log);
  const assets = new AssetService(db, settings, log);
  const build = new BuildService(settings, log);
  const hub = new CreatorHubService(devServer, projectFiles, log);
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
  ipcMain.handle(IpcChannels.SETTINGS_GET, () => {
    const s = settings.get();
    // 実キーはレンダラーに返さない（マスクのみ）
    return { ...s, openaiApiKey: secrets.mask(SECRET_OPENAI_KEY) };
  });
  ipcMain.handle(IpcChannels.SETTINGS_SET, (_e, partial: Partial<AppSettings>) => {
    const { openaiApiKey: _ignored, ...rest } = partial;
    const next = settings.set(rest);
    log.info('settings', '設定を更新しました');
    return { ...next, openaiApiKey: secrets.mask(SECRET_OPENAI_KEY) };
  });
  ipcMain.handle(IpcChannels.SETTINGS_SET_OPENAI_KEY, (_e, key: string) => {
    secrets.set(SECRET_OPENAI_KEY, (key ?? '').trim());
    settings.set({ openaiApiKey: '' });
    return { ok: true, mask: secrets.mask(SECRET_OPENAI_KEY) };
  });
  ipcMain.handle(IpcChannels.SETTINGS_GET_OPENAI_KEY_MASK, () => secrets.mask(SECRET_OPENAI_KEY));
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

  // --- ChatGPT ---
  ipcMain.handle(IpcChannels.CHAT_THREADS, (_e, query?: string) => chatGpt.listThreads(query));
  ipcMain.handle(IpcChannels.CHAT_MESSAGES, (_e, threadId: string) => chatGpt.getMessages(threadId));
  ipcMain.handle(IpcChannels.CHAT_CREATE, (_e, mode?: AiChatMode, projectPath?: string | null) =>
    chatGpt.createThread(mode ?? 'gamedev', projectPath),
  );
  ipcMain.handle(IpcChannels.CHAT_DELETE, (_e, threadId: string) => {
    chatGpt.deleteThread(threadId);
    return true;
  });
  ipcMain.handle(IpcChannels.CHAT_SET_MODE, (_e, threadId: string, mode: AiChatMode) => {
    chatGpt.setMode(threadId, mode);
    return true;
  });
  ipcMain.handle(
    IpcChannels.CHAT_SEND,
    (_e, threadId: string, content: string, projectPath?: string | null) =>
      chatGpt.send(threadId, content, projectPath),
  );
  ipcMain.handle(IpcChannels.CHAT_STOP, (_e, threadId: string) => chatGpt.stop(threadId));
  ipcMain.handle(
    IpcChannels.CHAT_REGENERATE,
    (_e, threadId: string, projectPath?: string | null) =>
      chatGpt.regenerate(threadId, projectPath),
  );

  // --- Prompt Builder ---
  ipcMain.handle(
    IpcChannels.PROMPT_BUILD,
    (
      _e,
      input: {
        gameContent: string;
        workContent: string;
        language: string;
        projectPath?: string | null;
      },
    ) => promptBuilder.generate(input),
  );
  ipcMain.handle(
    IpcChannels.CURSOR_SEND_PROMPT,
    (_e, prompt: string, folderPath?: string) => cursor.sendPromptToCursor(prompt, folderPath),
  );

  // --- UI 作成 AI（ChatGPT Web・APIキー不要） ---
  ipcMain.handle(IpcChannels.UI_CREATE_THEMES, () => uiCreateAi.listThemes());
  ipcMain.handle(IpcChannels.UI_CREATE_SCREENS, () => uiCreateAi.listScreens());
  ipcMain.handle(IpcChannels.UI_CREATE_PREPARE_CHATGPT, (_e, input: UiCreateAiRequest) =>
    uiCreateAi.prepareChatGpt(input),
  );
  ipcMain.handle(IpcChannels.UI_CREATE_PREPARE_REVIEW, (_e, markdown: string) =>
    uiCreateAi.prepareReviewPrompt(markdown),
  );
  ipcMain.handle(
    IpcChannels.UI_CREATE_ACCEPT_PASTE,
    (_e, input: UiCreateAiRequest, markdown: string) => uiCreateAi.acceptPaste(input, markdown),
  );
  ipcMain.handle(IpcChannels.UI_CREATE_OPEN_CHATGPT, (_e, url?: string) =>
    uiCreateAi.openChatGpt(url),
  );
  // 互換: 旧 generate / review は ChatGPT 準備に委譲
  ipcMain.handle(IpcChannels.UI_CREATE_GENERATE, (_e, input: UiCreateAiRequest) =>
    uiCreateAi.prepareChatGpt(input),
  );
  ipcMain.handle(IpcChannels.UI_CREATE_REVIEW, (_e, markdown: string) =>
    uiCreateAi.prepareReviewPrompt(markdown),
  );

  // --- Project Memory ---
  ipcMain.handle(IpcChannels.MEMORY_GET, (_e, projectPath: string) => {
    if (!projectPath) return null;
    return (
      projectMemory.getByProjectPath(projectPath) ||
      projectMemory.seedPokopokoIfNeeded(projectPath)
    );
  });
  ipcMain.handle(
    IpcChannels.MEMORY_SAVE,
    (_e, projectPath: string, partial: Record<string, string>) =>
      projectMemory.upsert(projectPath, partial),
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
  ipcMain.handle(IpcChannels.CURSOR_CHECK, () => cursor.checkConnection());
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
  ipcMain.handle(IpcChannels.GIT_CHECK, () => git.checkConnection());
  ipcMain.handle(IpcChannels.TOOLS_CHECK_CONNECTIONS, async () => {
    const [cursorStatus, gitStatus, blenderStatus, unityStatus] = await Promise.all([
      cursor.checkConnection(),
      git.checkConnection(),
      blender.probeConnection(),
      unity.probeConnection(),
    ]);
    return {
      cursor: cursorStatus,
      git: gitStatus,
      blender: blenderStatus,
      unity: unityStatus,
    };
  });
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
  ipcMain.handle(IpcChannels.HUB_OPEN_TOOL, async (_e, projectRoot: string, htmlPath: string) => {
    // 旧 UI 互換: HTTP ポートは使わず、専用 WebContentsView で開く
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      const [cw, ch] = win.getContentSize();
      const bounds = {
        x: Math.round(cw * 0.18),
        y: 96,
        width: Math.max(320, Math.round(cw * 0.82) - 16),
        height: Math.max(240, ch - 112),
      };
      const shown = await toolWorkspace.show(win, projectRoot, htmlPath, bounds);
      if (shown.success) {
        return {
          success: true,
          url: '',
          message: shown.message,
        };
      }
      return { success: false, url: '', message: shown.message };
    }
    return hub.resolveToolUrl(projectRoot, htmlPath);
  });
  ipcMain.handle(IpcChannels.HUB_OPEN_HUB, (_e, projectRoot: string) => hub.openHub(projectRoot));
  ipcMain.handle(
    IpcChannels.HUB_SHOW_TOOL_VIEW,
    async (
      _e,
      payload: {
        projectRoot: string;
        htmlPath: string;
        bounds: { x: number; y: number; width: number; height: number };
      },
    ) => {
      const win = getWindow();
      if (!win) {
        return { success: false, message: 'ウィンドウがありません' };
      }
      return toolWorkspace.show(win, payload.projectRoot, payload.htmlPath, payload.bounds);
    },
  );
  ipcMain.handle(IpcChannels.HUB_HIDE_TOOL_VIEW, () => {
    toolWorkspace.hide(getWindow());
    return true;
  });
  ipcMain.handle(
    IpcChannels.HUB_SET_TOOL_BOUNDS,
    (_e, bounds: { x: number; y: number; width: number; height: number }) => {
      toolWorkspace.setBounds(bounds);
      return true;
    },
  );
  ipcMain.handle(IpcChannels.HUB_RELOAD_TOOL_VIEW, () => {
    toolWorkspace.reload();
    return true;
  });
  ipcMain.handle(IpcChannels.HUB_SERVER_STATUS, () => ({
    running: false,
    port: 0,
    root: null,
    baseUrl: null,
    mode: 'idle' as const,
  }));
  ipcMain.handle(IpcChannels.HUB_SERVER_START, async (_e, projectRoot: string, port?: number) =>
    hub.ensureServer(projectRoot, port),
  );
  ipcMain.handle(IpcChannels.HUB_SERVER_STOP, async () => {
    toolWorkspace.hide(getWindow());
    return hub.stopServer();
  });
  ipcMain.handle(IpcChannels.HUB_RUN_SCRIPT, (_e, cwd: string, script: string) =>
    runner.runNpmScript(cwd, script),
  );
  ipcMain.handle(IpcChannels.PROJECT_REVEAL, async (_e, targetPath: string) => {
    await shell.showItemInFolder(targetPath);
  });
  ipcMain.handle(
    IpcChannels.PROJECT_WRITE_TEXT,
    async (
      _e,
      payload: { projectRoot: string; relativePath: string; content: string },
    ): Promise<{ success: boolean; message: string; absolutePath?: string }> => {
      const root = path.resolve(payload.projectRoot || '');
      const rel = (payload.relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
      if (!root || !fs.existsSync(root)) {
        return { success: false, message: 'プロジェクトフォルダがありません' };
      }
      if (!rel || rel.includes('..')) {
        return { success: false, message: '不正な相対パスです' };
      }
      const absolute = path.resolve(root, ...rel.split('/'));
      const prefix = root.endsWith(path.sep) ? root : root + path.sep;
      if (absolute !== root && !absolute.toLowerCase().startsWith(prefix.toLowerCase())) {
        return { success: false, message: 'プロジェクト外への書き込みは禁止されています' };
      }
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, payload.content ?? '', 'utf-8');
      log.info('project', 'テキスト書き込み', absolute);
      return { success: true, message: `保存しました: ${rel}`, absolutePath: absolute };
    },
  );
  ipcMain.handle(IpcChannels.HUB_OPEN_EXTERNAL, async (_e, url: string, projectRoot?: string) => {
    await hub.openInExternalBrowser(url, projectRoot);
  });

  // --- Blender AI ---
  ipcMain.handle(IpcChannels.BLENDER_STATUS, () => blender.getStatus());
  ipcMain.handle(IpcChannels.BLENDER_CONNECT, () => blender.connect());
  ipcMain.handle(IpcChannels.BLENDER_DISCONNECT, () => blender.disconnect());
  ipcMain.handle(IpcChannels.BLENDER_LAUNCH, () => blender.launch());
  ipcMain.handle(IpcChannels.BLENDER_CHECK_EXE, () => blender.checkExe());
  ipcMain.handle(IpcChannels.BLENDER_EXECUTE, (_e, method: string, params?: Record<string, unknown>) =>
    blender.execute(method, params ?? {}),
  );
  ipcMain.handle(IpcChannels.BLENDER_CHAT_SEND, (_e, content: string) => blenderChat.send(content));
  ipcMain.handle(IpcChannels.BLENDER_CHAT_CANCEL, (_e, messageId: string) => blenderChat.cancel(messageId));
  ipcMain.handle(IpcChannels.BLENDER_CHAT_RERUN, (_e, messageId: string) => blenderChat.rerun(messageId));
  ipcMain.handle(IpcChannels.BLENDER_CHAT_HISTORY, () => blenderChat.getHistory());
  ipcMain.handle(IpcChannels.BLENDER_CHAT_CLEAR, () => {
    blenderChat.clearHistory();
    return true;
  });
  ipcMain.handle(IpcChannels.BLENDER_TEMPLATES_LIST, () =>
    GAME_TEMPLATES.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      category: t.category,
    })),
  );
  ipcMain.handle(IpcChannels.BLENDER_TEMPLATES_RUN, async (_e, id: string) => {
    const t = GAME_TEMPLATES.find((x) => x.id === id);
    if (!t) throw new Error(`テンプレートが見つかりません: ${id}`);
    return blenderChat.send(t.phrases[0] ?? t.label);
  });
  ipcMain.handle(
    IpcChannels.BLENDER_GENERATE_FROM_PHOTO,
    async (_e, options?: { mode?: 'reference' | 'relief' | 'scene'; path?: string }) => {
      let imagePath = options?.path;
      if (!imagePath) {
        const win = getWindow();
        const result = await dialog.showOpenDialog(win ?? undefined!, {
          title: '写真を選択（3D 生成）',
          properties: ['openFile'],
          filters: [
            { name: '画像', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] },
            { name: 'すべて', extensions: ['*'] },
          ],
        });
        if (result.canceled || result.filePaths.length === 0) {
          return null;
        }
        imagePath = result.filePaths[0];
      }
      return blenderChat.generateFromPhoto(imagePath, options?.mode ?? 'scene');
    },
  );
  ipcMain.handle(
    IpcChannels.BLENDER_PREVIEW,
    async (_e, options?: { width?: number; height?: number; mode?: 'viewport' | 'render' }) => {
      try {
        const result = (await blender.execute('viewport.preview', {
          width: options?.width ?? 720,
          height: options?.height ?? 405,
          mode: options?.mode ?? 'viewport',
        })) as {
          ok?: boolean;
          mimeType?: string;
          data?: string;
          width?: number;
          height?: number;
          mode?: string;
          objectCount?: number;
          camera?: string | null;
        };
        return {
          ok: Boolean(result?.ok && result?.data),
          mimeType: result?.mimeType ?? 'image/png',
          data: result?.data ?? '',
          width: result?.width ?? 0,
          height: result?.height ?? 0,
          mode: result?.mode,
          objectCount: result?.objectCount,
          camera: result?.camera ?? null,
        };
      } catch (error) {
        return {
          ok: false,
          mimeType: 'image/png',
          data: '',
          width: 0,
          height: 0,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  // --- Unity AI ---
  ipcMain.handle(IpcChannels.UNITY_STATUS, () => unity.getStatus());
  ipcMain.handle(IpcChannels.UNITY_CONNECT, () => unity.connect());
  ipcMain.handle(IpcChannels.UNITY_DISCONNECT, () => unity.disconnect());
  ipcMain.handle(IpcChannels.UNITY_EXECUTE, (_e, method: string, params?: Record<string, unknown>) =>
    unity.execute(method, params ?? {}),
  );
  ipcMain.handle(IpcChannels.UNITY_CHAT_SEND, (_e, content: string) => unityChat.send(content));
  ipcMain.handle(IpcChannels.UNITY_CHAT_HISTORY, () => unityChat.getHistory());
  ipcMain.handle(IpcChannels.UNITY_CHAT_CLEAR, () => {
    unityChat.clearHistory();
    return true;
  });
  ipcMain.handle(IpcChannels.UNITY_QUICK_COMMANDS, () =>
    UNITY_QUICK_COMMANDS.map((c) => ({
      id: c.id,
      label: c.label,
      description: c.description,
      phrase: c.phrase,
    })),
  );
  ipcMain.handle(IpcChannels.UNITY_PACKAGE_PATH, () => unity.resolvePackagePath());
}
