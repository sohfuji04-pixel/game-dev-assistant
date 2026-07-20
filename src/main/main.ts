/**
 * Electron メインプロセス入口
 * MVVM の Model / Service を初期化し、IPC で ViewModel へ公開する。
 */
import { app, BrowserWindow, shell } from 'electron';
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
import { registerIpcHandlers } from './ipc/registerHandlers';

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
}

let services: AppServices | null = null;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'Game Dev Assistant',
    backgroundColor: '#0f1419',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
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

  log.info('app', 'アプリケーションを起動しました', `v${app.getVersion()}`);
  fileLog.info('app', 'boot', `userData=${userData}`);

  return { db, log, settings, watcher, updater, plugins, devServer, fileLog };
}

app.whenReady().then(async () => {
  services = await bootstrapServices();
  mainWindow = createWindow();
  registerIpcHandlers(services, () => mainWindow);

  const cfg = services.settings.get();
  if (app.isPackaged && cfg.autoUpdate) {
    void services.updater.checkForUpdates(cfg);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  services?.log.info('app', 'アプリケーションを終了します');
  void services?.devServer.stop();
  services?.watcher.stop();
  services?.db.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
