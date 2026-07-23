/**
 * UI 作成 AI スモーク（dev サーバー前提）
 * Usage:
 *   1) npm run electron:dev
 *   2) npx electron scripts/smoke-ui-create-ai.mjs
 */
import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs';
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

const SAMPLE_MARKDOWN = `# ① UIコンセプト
かわいい牧場ゲーム向けホーム画面（スモーク）

# ② レイアウト設計
SafeArea 対応

# ⑦ Cursor実装プロンプト
HomeUI.ts を作成し、下部メニューを実装してください。
`;

const THEMES = [
  {
    id: 'cute',
    label: 'かわいい',
    description: '丸み・パステル',
    palette: {
      primary: '#FF8FAB',
      secondary: '#FFC2D1',
      accent: '#A2D2FF',
      background: '#FFF7FB',
      text: '#5C4B5C',
      warning: '#FFB703',
      success: '#8AC926',
    },
  },
  {
    id: 'fantasy',
    label: 'ファンタジー',
    description: '魔法',
    palette: {
      primary: '#6B4EFF',
      secondary: '#9B7BFF',
      accent: '#E8B84A',
      background: '#1A1430',
      text: '#F4EEFF',
      warning: '#FF9F1C',
      success: '#2EC4B6',
    },
  },
];

const SCREENS = [
  {
    id: 'home',
    label: 'ホーム画面',
    description: '入口',
    typicalIcons: ['icon_home'],
  },
  {
    id: 'shop',
    label: 'ショップ画面',
    description: '購入',
    typicalIcons: ['icon_cart'],
  },
];

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

function assertPromptFiles() {
  const system = path.join(ROOT, 'src/main/ai/prompts/uiCreateAi/system.md');
  const review = path.join(ROOT, 'src/main/ai/prompts/uiCreateAi/review.md');
  if (!fs.existsSync(system)) fail(`system.md なし: ${system}`);
  if (!fs.existsSync(review)) fail(`review.md なし: ${review}`);
  const systemText = fs.readFileSync(system, 'utf8');
  for (const section of ['①', '⑦', '⑩', 'Cursor']) {
    if (!systemText.includes(section)) fail(`system.md に ${section} が無い`);
  }
  ok('外部プロンプトファイル');
}

function assertSharedModules() {
  const themes = path.join(ROOT, 'src/shared/uiCreateAi/themes.ts');
  const screens = path.join(ROOT, 'src/shared/uiCreateAi/screens.ts');
  if (!fs.existsSync(themes)) fail('themes.ts なし');
  if (!fs.existsSync(screens)) fail('screens.ts なし');
  const themeSrc = fs.readFileSync(themes, 'utf8');
  for (const id of [
    'cute',
    'fantasy',
    'japanese',
    'sf',
    'pop',
    'dark',
    'nordic',
    'nintendo',
    'picturebook',
    'luxury',
  ]) {
    if (!themeSrc.includes(`id: '${id}'`)) fail(`テーマ欠落: ${id}`);
  }
  ok('テーマ 10 種定義');
  const screenSrc = fs.readFileSync(screens, 'utf8');
  for (const id of ['home', 'shop', 'gacha', 'settings', 'encyclopedia', 'event', 'ranking']) {
    if (!screenSrc.includes(`id: '${id}'`)) fail(`画面欠落: ${id}`);
  }
  ok('主要画面テンプレート定義');
}

function stubIpc() {
  let lastGenerateInput = null;

  const handlers = {
    'app:get-version': () => 'smoke-ui-create',
    'app:get-paths': () => ({
      userData: ROOT,
      logs: path.join(ROOT, 'tmp'),
      assets: path.join(ROOT, 'tmp'),
    }),
    'settings:get': () => DEFAULT_SETTINGS,
    'settings:set': () => DEFAULT_SETTINGS,
    'settings:get-openai-key-mask': () => '',
    'project:recent': () => [],
    'updater:status': () => ({ status: 'idle' }),
    'updater:check': () => ({ status: 'idle' }),
    'chat:threads': () => [],
    'chat:messages': () => [],
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
    'ui-create:themes': () => THEMES,
    'ui-create:screens': () => SCREENS,
    'ui-create:generate': (_input) => {
      lastGenerateInput = _input;
      return {
        markdown: SAMPLE_MARKDOWN,
        detectedGenre: 'かわいい牧場ゲーム',
        appliedThemeId: 'cute',
        appliedScreenId: 'home',
        palette: THEMES[0].palette,
        generatedAt: new Date().toISOString(),
      };
    },
    'ui-create:review': () => '## 問題点\n- なし（スモーク）\n\n## 改善案\n- 余白を少し増やす',
    'cursor:send-prompt': () => ({ success: true, message: 'smoke: Cursor へ送信（スタブ）' }),
  };

  for (const [channel, fn] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (_e, ...args) => fn(...args));
  }

  const swallow = [
    'settings:select-path',
    'settings:set-openai-key',
    'chat:create',
    'chat:delete',
    'chat:set-mode',
    'chat:send',
    'chat:stop',
    'chat:regenerate',
    'prompt:build',
    'memory:get',
    'memory:save',
    'project:open',
    'project:remove-recent',
    'project:write-text',
    'project:reveal',
    'cursor:launch',
    'cursor:open-folder',
    'hub:scan',
    'hub:server-status',
  ];
  for (const ch of swallow) {
    if (handlers[ch]) continue;
    ipcMain.handle(ch, async () => null);
  }

  return {
    getLastGenerateInput: () => lastGenerateInput,
  };
}

app.whenReady().then(async () => {
  console.log('=== UI Create AI smoke ===');
  assertPromptFiles();
  assertSharedModules();

  if (!fs.existsSync(PRELOAD)) fail(`preload なし: ${PRELOAD}`);
  ok(`preload: ${PRELOAD}`);

  const ipc = stubIpc();

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
  await new Promise((r) => setTimeout(r, 1800));

  const navClicked = await win.webContents.executeJavaScript(`
    (() => {
      const buttons = [...document.querySelectorAll('.nav-btn')];
      const btn = buttons.find((b) => (b.textContent || '').includes('UI 作成 AI'));
      if (!btn) return { ok: false, labels: buttons.map((b) => b.textContent?.trim()) };
      btn.click();
      return { ok: true };
    })()
  `);
  if (!navClicked.ok) fail(`UI 作成 AI ナビ不可: ${JSON.stringify(navClicked)}`);
  ok('サイドバー UI 作成 AI へ遷移');
  await new Promise((r) => setTimeout(r, 900));

  const ui = await win.webContents.executeJavaScript(`
    (() => {
      const page = document.querySelector('.ui-create-page');
      const title = page?.querySelector('h2')?.textContent?.trim() || '';
      const textarea = page?.querySelector('textarea');
      const genBtn = [...(page?.querySelectorAll('button') || [])]
        .find((b) => (b.textContent || '').includes('UI 設計を生成'));
      const chips = [...(page?.querySelectorAll('.chip-btn') || [])]
        .map((b) => b.textContent?.trim());
      const select = page?.querySelector('select');
      const options = select
        ? [...select.options].map((o) => ({ value: o.value, label: o.textContent?.trim() }))
        : [];
      const swatches = page?.querySelectorAll('.ui-create-swatch')?.length || 0;
      return {
        title,
        hasTextarea: Boolean(textarea),
        prompt: textarea?.value || '',
        hasGen: Boolean(genBtn),
        chips,
        screenOptions: options,
        swatches,
      };
    })()
  `);

  if (ui.title !== 'UI 作成 AI') fail(`見出し不一致: ${JSON.stringify(ui)}`);
  ok('見出し UI 作成 AI');
  if (!ui.hasTextarea) fail('入力 textarea なし');
  ok('自然言語入力欄');
  if (!ui.hasGen) fail('生成ボタンなし');
  ok('生成ボタン');
  if (!ui.chips.includes('自動認識') || !ui.chips.includes('かわいい')) {
    fail(`テーマチップ不足: ${JSON.stringify(ui.chips)}`);
  }
  ok(`テーマチップ: ${ui.chips.join(', ')}`);
  if (!ui.screenOptions.some((o) => o.value === 'home')) fail('画面 select に home なし');
  ok(`画面テンプレ: ${ui.screenOptions.map((o) => o.label).join(', ')}`);
  if (ui.swatches < 7) fail(`パレット swatch 不足: ${ui.swatches}`);
  ok(`カラーパレット swatch ${ui.swatches}`);

  // 入力して生成
  const generated = await win.webContents.executeJavaScript(`
    (async () => {
      const page = document.querySelector('.ui-create-page');
      const textarea = page.querySelector('textarea');
      const nativeSet = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      ).set;
      nativeSet.call(textarea, 'かわいい牧場ゲーム\\nホーム画面');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));

      const genBtn = [...page.querySelectorAll('button')]
        .find((b) => (b.textContent || '').includes('UI 設計を生成'));
      genBtn.click();
      await new Promise((r) => setTimeout(r, 800));

      const result = page.querySelector('.ui-create-markdown')?.innerText || '';
      const meta = page.querySelector('.ui-create-result .meta')?.textContent?.trim() || '';
      const banner = document.querySelector('.banner')?.textContent?.trim() || '';
      return { result, meta, banner };
    })()
  `);

  if (!generated.result.includes('UIコンセプト') && !generated.result.includes('①')) {
    fail(`生成結果なし: ${JSON.stringify(generated).slice(0, 400)}`);
  }
  ok('スタブ生成結果を表示');
  if (!generated.meta.includes('cute') && !generated.meta.includes('home')) {
    // meta は detectedGenre · theme · screen
    if (!/牧場|cute|home/i.test(generated.meta + generated.banner)) {
      fail(`メタ情報不足: meta=${generated.meta} banner=${generated.banner}`);
    }
  }
  ok(`生成メタ: ${generated.meta || generated.banner}`);

  const input = ipc.getLastGenerateInput();
  if (!input || !String(input.prompt || '').includes('牧場')) {
    fail(`generate IPC 入力不正: ${JSON.stringify(input)}`);
  }
  ok(`IPC generate 受信: prompt 長さ ${String(input.prompt).length}`);

  // Cursor プロンプト抽出ボタン
  const cursorCopy = await win.webContents.executeJavaScript(`
    (() => {
      const page = document.querySelector('.ui-create-page');
      const btn = [...page.querySelectorAll('button')]
        .find((b) => (b.textContent || '').includes('Cursor プロンプト'));
      return { enabled: btn && !btn.disabled, label: btn?.textContent?.trim() || '' };
    })()
  `);
  if (!cursorCopy.enabled) fail(`Cursor プロンプトボタン無効: ${JSON.stringify(cursorCopy)}`);
  ok('Cursor プロンプトボタン有効');

  win.destroy();
  console.log('=== ALL PASSED ===');
  app.exit(0);
});
