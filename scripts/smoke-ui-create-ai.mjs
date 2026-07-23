/**
 * UI 作成 AI スモーク（dev サーバ前提・OpenAI API 不要）
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
  throw new Error(msg);
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

function makePack(overrides = {}) {
  return {
    chatGptPrompt: '【スモーク】ChatGPT 用プロンプト\nかわいい牧場ゲーム',
    chatgptUrl: 'https://chatgpt.com/',
    detectedGenre: 'かわいい牧場ゲーム',
    appliedThemeId: 'cute',
    appliedScreenId: 'home',
    palette: THEMES[0].palette,
    preparedAt: new Date().toISOString(),
    instructions: 'ChatGPT に貼り付けて返答を戻してください（スモーク）',
    ...overrides,
  };
}

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
  let lastPrepareInput = null;
  let lastAccept = null;
  let openChatGptCalls = 0;

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
    'ui-create:prepare-chatgpt': (input) => {
      lastPrepareInput = input;
      return makePack();
    },
    'ui-create:prepare-review': (markdown) =>
      makePack({
        chatGptPrompt: '【スモーク】レビュー依頼\n' + String(markdown || '').slice(0, 80),
        instructions: '改善レビュー用プロンプトをコピーしました（スモーク）',
      }),
    'ui-create:accept-paste': (input, markdown) => {
      lastAccept = { input, markdown };
      return {
        markdown: String(markdown || SAMPLE_MARKDOWN),
        detectedGenre: 'かわいい牧場ゲーム',
        appliedThemeId: 'cute',
        appliedScreenId: 'home',
        palette: THEMES[0].palette,
        generatedAt: new Date().toISOString(),
        source: 'paste',
      };
    },
    'ui-create:open-chatgpt': (url) => {
      openChatGptCalls += 1;
      return { ok: true, url: url || 'https://chatgpt.com/' };
    },
    'ui-create:generate': () => {
      fail('OpenAI generate が呼ばれた（キーレスフローでは不要）');
    },
    'ui-create:review': () => {
      fail('OpenAI review が呼ばれた（キーレスフローでは不要）');
    },
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
    getLastPrepareInput: () => lastPrepareInput,
    getLastAccept: () => lastAccept,
    getOpenChatGptCalls: () => openChatGptCalls,
  };
}

app.whenReady().then(async () => {
  console.log('=== UI Create AI smoke (ChatGPT keyless) ===');
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

  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'clipboard-sanitized-write' || permission === 'clipboard-read') {
      callback(true);
      return;
    }
    callback(false);
  });

  try {
    await win.loadURL(DEV_URL);
  } catch (err) {
    fail(`loadURL 失敗: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  ok(`ロード: ${DEV_URL}`);
  win.show();
  win.focus();
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
      const textareas = [...(page?.querySelectorAll('textarea') || [])];
      const promptArea = textareas[0];
      const pasteArea = textareas.find((t) => {
        const ph = t.getAttribute('placeholder') || '';
        const label = t.closest('.field')?.querySelector('label')?.textContent || '';
        return (
          label.includes('ChatGPT') ||
          label.includes('貼り付け') ||
          ph.includes('ChatGPT') ||
          ph.includes('貼り付け') ||
          ph.includes('Markdown')
        );
      }) || textareas[1];
      const primaryBtns = [...(page?.querySelectorAll('button.primary') || [])];
      const chatgptBtn = primaryBtns.find((b) => (b.textContent || '').includes('ChatGPT'));
      const acceptBtn = [...(page?.querySelectorAll('button') || [])].find((b) =>
        (b.textContent || '').includes('結果として取り込む'),
      );
      const chips = [...(page?.querySelectorAll('.chip-btn') || [])].map((b) =>
        b.textContent?.trim(),
      );
      const select = page?.querySelector('select');
      const options = select
        ? [...select.options].map((o) => ({ value: o.value, label: o.textContent?.trim() }))
        : [];
      const pasteLabel =
        pasteArea?.closest('.field')?.querySelector('label')?.textContent?.trim() || '';
      return {
        title,
        hasPrompt: Boolean(promptArea),
        hasPaste: Boolean(pasteArea),
        pasteLabel,
        pastePlaceholder: pasteArea?.getAttribute('placeholder') || '',
        chatgptBtnText: chatgptBtn?.textContent?.trim() || '',
        hasAccept: Boolean(acceptBtn),
        chips,
        screenOptions: options,
      };
    })()
  `);

  if (ui.title !== 'UI 作成 AI') fail(`見出し不一致: ${JSON.stringify(ui)}`);
  ok('見出し: UI 作成 AI');
  if (!ui.hasPrompt) fail('入力 textarea なし');
  ok('自然言語入力欄');
  if (!ui.chatgptBtnText.includes('ChatGPT')) {
    fail(`プライマリボタンに ChatGPT なし: ${ui.chatgptBtnText}`);
  }
  ok(`プライマリ: ${ui.chatgptBtnText}`);
  const pasteOk =
    ui.hasPaste &&
    (ui.pasteLabel.includes('ChatGPT') ||
      ui.pasteLabel.includes('貼り付け') ||
      ui.pastePlaceholder.includes('ChatGPT') ||
      ui.pastePlaceholder.includes('貼り付け') ||
      ui.pastePlaceholder.includes('Markdown'));
  if (!pasteOk) {
    fail(`貼り付け欄なし: label=${ui.pasteLabel} ph=${ui.pastePlaceholder}`);
  }
  ok(`貼り付け欄: ${ui.pasteLabel || ui.pastePlaceholder.slice(0, 40)}`);
  if (!ui.hasAccept) fail('「結果として取り込む」ボタンなし');
  ok('結果として取り込むボタン');
  if (!ui.chips.includes('自動認識') || !ui.chips.includes('かわいい')) {
    fail(`テーマチップ不足: ${JSON.stringify(ui.chips)}`);
  }
  ok(`テーマチップ: ${ui.chips.join(', ')}`);
  if (!ui.screenOptions.some((o) => o.value === 'home')) fail('画面 select に home なし');
  ok(`画面テンプレ: ${ui.screenOptions.map((o) => o.label).join(', ')}`);


  // navigator.clipboard は非フォーカス窓で失敗するためモック
  await win.webContents.executeJavaScript(`
    (() => {
      const fake = {
        writeText: async () => {},
        readText: async () => '',
      };
      try {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          get: () => fake,
        });
      } catch {
        navigator.clipboard.writeText = async () => {};
      }
      return true;
    })()
  `);

  const prepared = await win.webContents.executeJavaScript(`
    (async () => {
      const page = document.querySelector('.ui-create-page');
      const textarea = page.querySelectorAll('textarea')[0];
      const nativeSet = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      ).set;
      nativeSet.call(textarea, 'かわいい牧場ゲーム\\nホーム画面');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));

      const btn = [...page.querySelectorAll('button.primary')].find((b) =>
        (b.textContent || '').includes('ChatGPT'),
      );
      if (!btn) return { ok: false, reason: 'no ChatGPT button' };
      btn.click();
      await new Promise((r) => setTimeout(r, 900));
      const banner = document.querySelector('.banner')?.textContent?.trim() || '';
      const preview = page.querySelector('.ui-create-prompt-preview');
      return {
        ok: true,
        banner,
        hasPreview: Boolean(preview),
        previewText: preview?.querySelector('pre')?.textContent?.slice(0, 120) || '',
      };
    })()
  `);
  if (!prepared.ok) fail(`ChatGPT 生成クリック失敗: ${JSON.stringify(prepared)}`);
  const prepInput = ipc.getLastPrepareInput();
  if (!prepInput || !String(prepInput.prompt || '').includes('牧場')) {
    fail(`prepare-chatgpt 入力不正: ${JSON.stringify(prepInput)}`);
  }
  ok(`IPC prepare-chatgpt: prompt 長さ ${String(prepInput.prompt).length}`);
  if (ipc.getOpenChatGptCalls() < 1) fail('open-chatgpt が呼ばれていない');
  ok(`IPC open-chatgpt calls: ${ipc.getOpenChatGptCalls()}`);
  ok(`生成後バナー/プレビュー: ${(prepared.banner || prepared.previewText || '').slice(0, 80)}`);

  const accepted = await win.webContents.executeJavaScript(`
    (async () => {
      const page = document.querySelector('.ui-create-page');
      const textareas = [...page.querySelectorAll('textarea')];
      const pasteArea =
        textareas.find((t) => {
          const ph = t.getAttribute('placeholder') || '';
          const label = t.closest('.field')?.querySelector('label')?.textContent || '';
          return (
            label.includes('ChatGPT') ||
            label.includes('貼り付け') ||
            ph.includes('ChatGPT') ||
            ph.includes('貼り付け') ||
            ph.includes('Markdown')
          );
        }) || textareas[1];
      if (!pasteArea) return { ok: false, reason: 'no paste textarea' };
      const sample = '# ① UIコンセプト\\nかわいい牧場ゲーム向けホーム画面（スモーク）\\n\\n# ② レイアウト設計\\nSafeArea 対応\\n\\n# ⑦ Cursor実装プロンプト\\nHomeUI.ts を作成し、下部メニューを実装してください。';
      const nativeSet = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      ).set;
      nativeSet.call(pasteArea, sample);
      pasteArea.dispatchEvent(new Event('input', { bubbles: true }));
      pasteArea.dispatchEvent(new Event('change', { bubbles: true }));

      const acceptBtn = [...page.querySelectorAll('button')].find((b) =>
        (b.textContent || '').includes('結果として取り込む'),
      );
      if (!acceptBtn) return { ok: false, reason: 'no accept button' };
      acceptBtn.click();
      await new Promise((r) => setTimeout(r, 900));

      const result = page.querySelector('.ui-create-markdown')?.innerText || '';
      const meta = page.querySelector('.ui-create-result .meta')?.textContent?.trim() || '';
      const banner = document.querySelector('.banner')?.textContent?.trim() || '';
      return { ok: true, result, meta, banner };
    })()
  `);
  if (!accepted.ok) fail(`取り込み失敗: ${JSON.stringify(accepted)}`);
  if (!accepted.result.includes('UIコンセプト') && !accepted.result.includes('①')) {
    fail(`結果表示なし: ${JSON.stringify(accepted).slice(0, 400)}`);
  }
  ok('スタブ取り込み結果を表示');
  const lastAccept = ipc.getLastAccept();
  if (!lastAccept || !String(lastAccept.markdown || '').includes('UIコンセプト')) {
    fail(`accept-paste 入力不正: ${String(JSON.stringify(lastAccept)).slice(0, 300)}`);
  }
  ok('IPC accept-paste 受信');
  if (!/牧場|cute|home/i.test(accepted.meta + accepted.banner)) {
    fail(`メタ情報不足: meta=${accepted.meta} banner=${accepted.banner}`);
  }
  ok(`取り込みメタ: ${accepted.meta || accepted.banner}`);

  const cursorCopy = await win.webContents.executeJavaScript(`
    (() => {
      const page = document.querySelector('.ui-create-page');
      const btn = [...page.querySelectorAll('button')].find((b) =>
        (b.textContent || '').includes('Cursor プロンプト'),
      );
      return { enabled: btn && !btn.disabled, label: btn?.textContent?.trim() || '' };
    })()
  `);
  if (!cursorCopy.enabled) fail(`Cursor プロンプトボタン無効: ${JSON.stringify(cursorCopy)}`);
  ok('Cursor プロンプトボタン有効');

  win.destroy();
  console.log('=== ALL PASSED ===');
  app.exit(0);
});
