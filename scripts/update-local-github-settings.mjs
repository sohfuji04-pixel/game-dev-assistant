/**
 * ローカル設定 DB の GitHub owner/repo を更新するワンショット
 */
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dbPath = process.env.DB;
if (!dbPath || !fs.existsSync(dbPath)) {
  console.log('no local db');
  process.exit(0);
}

const wasm = path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm');
const SQL = await initSqlJs({ locateFile: () => wasm });
const db = new SQL.Database(fs.readFileSync(dbPath));
const row = db.exec("SELECT value FROM settings WHERE key='app_settings'");
let settings = {};
if (row[0]?.values?.[0]?.[0]) {
  settings = JSON.parse(String(row[0].values[0][0]));
}
settings.updateOwner = 'sohfuji04-pixel';
settings.updateRepo = 'game-dev-assistant';
db.run(
  "INSERT INTO settings(key,value) VALUES('app_settings', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  [JSON.stringify(settings)],
);
fs.writeFileSync(dbPath, Buffer.from(db.export()));
console.log('updated', settings.updateOwner, settings.updateRepo);
