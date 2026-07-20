/**
 * Electron メインプロセス入口
 * MVVM の Model / Service を初期化し、IPC で ViewModel へ公開する。
 */
import { app, BrowserWindow, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseService } from './database/DatabaseService';
import { FileLogService } from './logs/FileLogService';
import { LogService } from './logs/LogService';
import { SettingsService } from './settings/SettingsService';
import { WatcherService } from './services/WatcherService';
import { UpdaterService } from './updater/UpdaterService';
import { PluginService } from './plugins/PluginService';
import { DevServerService } from './services/DevServerService';
import { BlenderConnectionService } from './blender/BlenderConnectionService';
import { BlenderAIChatService } from './blender/BlenderAIChatService';
import { UnityConnectionService } from './unity/UnityConnectionService';
import { UnityAIChatService } from './unity/UnityAIChatService';
import { registerIpcHandlers } from './ipc/registerHandlers';
import { IpcChannels } from '../shared/ipcChannels';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

export interface AppServices {
  db: DatabaseService;
  log: LogService;
  settings: SettingsService;
  watcher: WatcherService;
  updater: UpdaterService;
  plugins: PluginService;
  devServer: DevServerService;
  fileLog: FileLogService;
  blender: BlenderConnectionService;
  blenderChat: BlenderAIChatService;
  unity: UnityConnectionService;
  unityChat: UnityAIChatService;
}

let services: AppServices | null = null;

function resolvePreloadPath(): string {
  // 開発: dist-electron/preload.cjs / 本番: asar 内同階層
  const candidates = [
    path.join(__dirname, 'preload.cjs'),
    path.join(__dirname, 'preload.js'),
    path.join(__dirname, 'preload.mjs'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function createWindow(): BrowserWindow {
  const preloadPath = resolvePreloadPath();
  console.log('[main] preload =', preloadPath, 'packaged =', app.isPackaged);

  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'Game Dev Assistant',
    backgroundColor: '#0f1419',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.webContents.on('preload-error', (_event, preloadPathFailed, error) => {
    console.error('[main] preload-error', preloadPathFailed, error);
  });

  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    void win.loadURL('http://localhost:5173');
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return win;
}

async function bootstrapServices(): Promise<AppServices> {
  const userData = app.getPath('userData');
  const logsDir = path.join(userData, 'logs');
  const fileLog = new FileLogService(logsDir);

  const db = new DatabaseService(path.join(userData, 'gda.db'));
  await db.init();
  db.migrate();
  db.seedCreatorPromptsIfEmpty();

  const log = new LogService(db, fileLog);
  const settings = new SettingsService(db, userData);
  await settings.ensureDefaults();

  const watcher = new WatcherService((event) => {
    mainWindow?.webContents.send('watcher:event', event);
  });

  const updater = new UpdaterService((status) => {
    mainWindow?.webContents.send('updater:status', status);
  }, log);

  updater.applySettings(settings.get());

  const plugins = new PluginService(path.join(userData, 'plugins'));
  await plugins.loadAll();

  const devServer = new DevServerService(log);

  const blender = new BlenderConnectionService(settings, log);
  const blenderChat = new BlenderAIChatService(settings, blender, log, (msg) => {
    mainWindow?.webContents.send(IpcChannels.BLENDER_CHAT_PROGRESS, msg);
  });
  blender.on('status', (status) => {
    mainWindow?.webContents.send(IpcChannels.BLENDER_CONNECTION_CHANGED, status);
  });

  const unity = new UnityConnectionService(settings, log);
  const unityChat = new UnityAIChatService(settings, unity, log, (msg) => {
    mainWindow?.webContents.send(IpcChannels.UNITY_CHAT_PROGRESS, msg);
  });
  unity.on('status', (status) => {
    mainWindow?.webContents.send(IpcChannels.UNITY_CONNECTION_CHANGED, status);
  });

  log.info('app', 'アプリケーションを起動しました', `v${app.getVersion()}`);
  fileLog.info('app', 'boot', `userData=${userData}`);

  return {
    db,
    log,
    settings,
    watcher,
    updater,
    plugins,
    devServer,
    fileLog,
    blender,
    blenderChat,
    unity,
    unityChat,
  };
}

app.whenReady().then(async () => {
  services = await bootstrapServices();
  mainWindow = createWindow();
  registerIpcHandlers(services, () => mainWindow);

  const cfg = services.settings.get();
  // パッケージ済みかつ autoUpdate ON のときだけ確認（失敗しても起動は継続）
  if (app.isPackaged && cfg.autoUpdate) {
    void services.updater.checkForUpdates(cfg).catch((err) => {
      services?.log.warn('updater', '起動時更新確認をスキップ', String(err));
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  services?.log.info('app', 'アプリケーションを終了します');
  void services?.blender.disconnect();
  void services?.unity.disconnect();
  void services?.devServer.stop();
  services?.watcher.stop();
  services?.db.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
