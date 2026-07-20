/**
 * 創作ツール専用画面スモーク（file:// + WebContentsView / 再起動不要経路）
 * Usage: npx electron scripts/smoke-hub-open.mjs
 */
import { app, BrowserWindow, WebContentsView } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PROJECT = path.join(ROOT, 'tmp', 'smoke-project');
const HTML_REL = 'tools/board-editor.html';

function fail(msg) {
  console.error('[FAIL]', msg);
  app.exit(1);
}

function ok(msg) {
  console.log('[OK]', msg);
}

app.whenReady().then(async () => {
  console.log('=== Hub WebContentsView smoke test ===');
  const filePath = path.join(PROJECT, ...HTML_REL.split('/'));
  if (!fs.existsSync(filePath)) {
    fail(`フィクスチャなし: ${filePath}`);
    return;
  }
  ok('フィクスチャ確認');

  const win = new BrowserWindow({
    width: 960,
    height: 700,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // アプリ本体相当のプレースホルダ
  await win.loadURL('data:text/html,<html><body style="background:#111"></body></html>');

  const view = new WebContentsView({
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.contentView.addChildView(view);
  view.setBounds({ x: 40, y: 80, width: 880, height: 560 });

  const fileUrl = pathToFileURL(filePath).href;
  if (fileUrl.startsWith('http://') || fileUrl.includes(':8780')) {
    fail(`想定外 URL: ${fileUrl}`);
    return;
  }
  ok(`file:// URL: ${fileUrl}`);

  try {
    await view.webContents.loadURL(fileUrl);
  } catch (err) {
    fail(`loadURL 失敗: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  ok('専用画面を file:// で表示（プロトコル/ポート不要）');

  const marker = await view.webContents.executeJavaScript('window.__GDA_SMOKE__');
  if (marker !== 'loaded') {
    fail(`JS 未読込: ${marker}`);
    return;
  }
  ok('相対 JS 読み込み');

  await view.webContents.executeJavaScript(`document.getElementById('ping').click()`);
  const status = await view.webContents.executeJavaScript(
    `document.getElementById('status').textContent`,
  );
  if (status !== 'clicked') {
    fail(`操作失敗: status=${status}`);
    return;
  }
  ok('ボタン操作');

  // 同じウィンドウ内で別ツールへ切替（再起動なし）
  const hubPath = path.join(PROJECT, 'creator-hub.html');
  await view.webContents.loadURL(pathToFileURL(hubPath).href);
  const title = await view.webContents.executeJavaScript('document.title');
  if (!/Creator Hub/i.test(title)) {
    fail(`切替失敗 title=${title}`);
    return;
  }
  ok('再起動なしで別画面へ切替');

  win.contentView.removeChildView(view);
  view.webContents.close();
  win.destroy();
  console.log('=== ALL PASSED ===');
  app.exit(0);
});
