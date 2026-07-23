/**
 * ChatGPT 反映先 UI スモーク（dev サーバー前提）
 * Usage: npx electron scripts/smoke-chatgpt-apply.mjs
 */
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PRELOAD = path.join(ROOT, 'dist-electron', 'preload.cjs');
const DEV_URL = process.env.GDA_SMOKE_URL || 'http://localhost:5173/';

function fail(msg) {
  console.error('[FAIL]', msg);
  app.exit(1);
}

function ok(msg) {
  console.log('[OK]', msg);
}

const DEFAULT_SETTINGS = {
  theme: 'dark',
  dataPath: path.join(ROOT, 'tmp'),
  cursorExePath: '',
  gitPath: 'git',
  androidSdkPath: '',
  defaultProjectPath: '',
  updateOwner: 'sohfuji04-pixel',
  updateRepo: 'game-dev-assistant',
  updateChannel: 'latest',
  autoUpdate: false,
  updateRetryCount: 0,
  blenderExePath: '',
  blenderHost: '127.0.0.1',
  blenderPort: 8775,
  autoReconnectBlender: false,
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  unityWsUrl: 'ws://127.0.0.1:8765/unity/',
  unityEditorPath: '',
  unityProjectPath: '',
};

function stubIpc() {
  const handlers = {
    'app:get-version': () => 'smoke',
    'app:get-paths': () => ({
      userData: ROOT,
      logs: path.join(ROOT, 'tmp'),
      assets: path.join(ROOT, 'tmp'),
    }),
    'settings:get': () => DEFAULT_SETTINGS,
    'settings:set': (_p) => DEFAULT_SETTINGS,
    'settings:get-openai-key-mask': () => '',
    'project:recent': () => [],
    'updater:status': () => ({ status: 'idle' }),
    'updater:check': () => ({ status: 'idle' }),
    'chat:threads': () => [],
    'chat:messages': () => [],
    'chat:create': () => ({
      id: 't1',
      title: '新しいチャット',
      mode: 'gamedev',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    'chat:delete': () => true,
    'chat:set-mode': () => true,
    'log:append': () => ({}),
    'log:list': () => [],
    'changelog:list': () => [],
    'plugin:list': () => [],
    'assets:list': () => [],
    'prompt:list': () => [],
    'prompt:history': () => [],
    'tools:check-connections': () => ({
      cursor: { ok: false, message: 'smoke' },
      git: { ok: false, message: 'smoke' },
    }),
    'cursor:check': () => ({ ok: false, message: 'smoke' }),
    'git:check': () => ({ ok: false, message: 'smoke' }),
    'blender:status': () => ({
      connected: false,
      blenderVersion: null,
      host: '127.0.0.1',
      port: 8775,
      lastError: null,
      pid: null,
    }),
    'unity:status': () => ({
      connected: false,
      host: '127.0.0.1',
      port: 8765,
      lastError: null,
    }),
  };

  for (const [channel, fn] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (_e, ...args) => fn(...args));
  }

  // 残りのチャンネルは空で握りつぶし（invoke 失敗で画面が落ちないように）
  const known = new Set(Object.keys(handlers));
  const channels = [
    'settings:select-path',
    'settings:set-openai-key',
    'chat:send',
    'chat:stop',
    'chat:regenerate',
    'prompt:build',
    'cursor:send-prompt',
    'memory:get',
    'memory:save',
    'project:open',
    'project:remove-recent',
    'project:write-text',
    'project:reveal',
    'cursor:launch',
    'cursor:open-folder',
    'prompt:save',
    'prompt:delete',
    'prompt:search',
    'prompt:add-history',
    'watcher:start',
    'watcher:stop',
    'git:status',
    'git:commit',
    'git:push',
    'git:pull',
    'git:branches',
    'git:checkout',
    'git:create-branch',
    'git:release',
    'build:windows',
    'build:android',
    'updater:download',
    'updater:install',
    'assets:import',
    'assets:delete',
    'assets:open-folder',
    'log:clear',
    'plugin:invoke',
    'hub:scan',
    'hub:open-tool',
    'hub:open-hub',
    'hub:show-tool-view',
    'hub:hide-tool-view',
    'hub:set-tool-bounds',
    'hub:reload-tool-view',
    'hub:server-status',
    'hub:server-start',
    'hub:server-stop',
    'hub:run-script',
    'hub:open-external',
    'blender:connect',
    'blender:disconnect',
    'blender:launch',
    'blender:check-exe',
    'blender:execute',
    'blender:chat-send',
    'blender:chat-cancel',
    'blender:chat-rerun',
    'blender:chat-history',
    'blender:chat-clear',
    'blender:templates-list',
    'blender:templates-run',
    'blender:preview',
    'blender:generate-from-photo',
    'unity:connect',
    'unity:disconnect',
    'unity:execute',
    'unity:chat-send',
    'unity:chat-history',
    'unity:chat-clear',
    'unity:quick-commands',
    'unity:package-path',
  ];
  for (const ch of channels) {
    if (known.has(ch)) continue;
    ipcMain.handle(ch, async () => null);
  }
}

app.whenReady().then(async () => {
  console.log('=== ChatGPT apply UI smoke ===');
  stubIpc();

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    await win.loadURL(DEV_URL);
  } catch (err) {
    fail(`loadURL 失敗: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  ok(`ロード: ${DEV_URL}`);

  await new Promise((r) => setTimeout(r, 1500));

  const navClicked = await win.webContents.executeJavaScript(`
    (() => {
      const buttons = [...document.querySelectorAll('.nav-btn')];
      const btn = buttons.find((b) => (b.textContent || '').includes('ChatGPT'));
      if (!btn) return 'missing-nav';
      btn.click();
      return 'clicked';
    })()
  `);
  if (navClicked !== 'clicked') fail(`ChatGPT ナビ不可: ${navClicked}`);
  ok('サイドバー ChatGPT へ遷移');

  await new Promise((r) => setTimeout(r, 700));

  const ui = await win.webContents.executeJavaScript(`
    (() => {
      const title = document.querySelector('.chatgpt-page h2')?.textContent?.trim() || '';
      const applySelect = document.getElementById('chatgpt-apply-target');
      const applyBtn = document.querySelector('.apply-latest-btn');
      const hint = document.querySelector('.apply-hint')?.textContent?.trim() || '';
      const group = [...document.querySelectorAll('.nav-group-label')]
        .map((el) => el.textContent?.trim())
        .includes('AI / 3D');
      const options = applySelect
        ? [...applySelect.options].map((o) => o.value)
        : [];
      return {
        title,
        hasSelect: Boolean(applySelect),
        applyDisabled: applyBtn?.disabled ?? null,
        applyLabel: applyBtn?.textContent?.trim() || '',
        hint,
        hasAiGroup: group,
        options,
      };
    })()
  `);

  if (ui.title !== 'ChatGPT') fail(`見出し不一致: ${JSON.stringify(ui)}`);
  ok('ChatGPT 見出し');
  if (!ui.hasAiGroup) fail('サイドバーに AI / 3D グループなし');
  ok('AI / 3D グループ');
  if (!ui.hasSelect) fail('反映先 select なし');
  ok('反映先セレクト');
  const expected = ['clipboard', 'cursor', 'blender', 'unity', 'file'];
  if (expected.some((id) => !ui.options.includes(id))) {
    fail(`反映先不足: ${JSON.stringify(ui.options)}`);
  }
  ok(`反映先 5 種: ${ui.options.join(',')}`);
  if (!ui.applyLabel.includes('最新を反映')) fail(`反映ボタン文言: ${ui.applyLabel}`);
  ok(`反映ボタン: ${ui.applyLabel}`);
  if (!ui.hint) fail('ヒント文言なし');
  ok(`ヒント: ${ui.hint}`);
  if (ui.applyDisabled !== true) fail('返答なし時は反映ボタン disabled であるべき');
  ok('返答なし時は反映ボタン無効');

  const switched = await win.webContents.executeJavaScript(`
    (() => {
      const sel = document.getElementById('chatgpt-apply-target');
      sel.value = 'cursor';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return {
        hint: document.querySelector('.apply-hint')?.textContent?.trim() || '',
        btn: document.querySelector('.apply-latest-btn')?.textContent?.trim() || '',
        stored: localStorage.getItem('gda.chatgpt.applyTarget'),
      };
    })()
  `);
  if (!switched.btn.includes('Cursor')) fail(`切替後ボタン: ${switched.btn}`);
  if (switched.stored !== 'cursor') fail(`localStorage 未保存: ${switched.stored}`);
  ok('反映先を Cursor に切替・永続化');

  // ファイル反映時の警告表示
  const fileUi = await win.webContents.executeJavaScript(`
    (() => {
      const sel = document.getElementById('chatgpt-apply-target');
      sel.value = 'file';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      const pathInput = document.getElementById('chatgpt-apply-path');
      const warn = [...document.querySelectorAll('.apply-hint.warn')]
        .map((el) => el.textContent?.trim())
        .join(' ');
      return {
        hasPath: Boolean(pathInput),
        warn,
        btn: document.querySelector('.apply-latest-btn')?.textContent?.trim() || '',
      };
    })()
  `);
  if (!fileUi.hasPath) fail('ファイルパス入力なし');
  if (!fileUi.warn.includes('プロジェクト')) fail(`ファイル警告なし: ${fileUi.warn}`);
  ok('ファイル反映時のパス入力と警告');

  win.destroy();
  console.log('=== ALL PASSED ===');
  app.exit(0);
});
