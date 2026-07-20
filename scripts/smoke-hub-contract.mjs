/**
 * CreatorHubService.resolveToolUrl 相当の単体確認（ビルド成果物の契約）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PROJECT = path.join(ROOT, 'tmp', 'smoke-project');
const mainJs = path.join(ROOT, 'dist-electron', 'main.js');

const checks = [];

function check(name, cond, detail = '') {
  checks.push({ name, ok: Boolean(cond), detail });
  console.log(cond ? `[OK] ${name}` : `[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
}

check('dist-electron/main.js がある', fs.existsSync(mainJs));
const src = fs.readFileSync(mainJs, 'utf8');
check('ビルドに gda-project プロトコルが含まれる', src.includes('gda-project'));
check('ビルドに HTTP 8780 必須起動が創作 open に残っていない（プロトコル優先）', src.includes('gda-project://'));
check('smoke プロジェクトに board-editor がある', fs.existsSync(path.join(PROJECT, 'tools', 'board-editor.html')));
check('smoke プロジェクトに creator-hub がある', fs.existsSync(path.join(PROJECT, 'creator-hub.html')));

const url = `gda-project://workspace/tools/board-editor.html`;
check('アプリ内 URL にポート番号が無い', !/:\d{2,5}/.test(url) && !url.startsWith('http'));

const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed`);
  process.exit(1);
}
console.log('\n=== CONTRACT CHECKS PASSED ===');
