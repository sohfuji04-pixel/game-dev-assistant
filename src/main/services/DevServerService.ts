/**
 * プロジェクト内の静的ファイルを配信する開発サーバ
 * ぽこぽこの serve-local.mjs 相当を Electron 内に内蔵する。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import type { LogService } from './LogService';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

export interface DevServerStatus {
  running: boolean;
  port: number;
  root: string | null;
  baseUrl: string | null;
  mode: 'builtin' | 'script' | 'idle';
}

export class DevServerService {
  private server: http.Server | null = null;
  private child: ChildProcess | null = null;
  private status: DevServerStatus = {
    running: false,
    port: 8780,
    root: null,
    baseUrl: null,
    mode: 'idle',
  };

  constructor(private readonly log: LogService) {}

  getStatus(): DevServerStatus {
    return { ...this.status };
  }

  /**
   * プロジェクトルートを静的配信する（アプリ内埋め込み用は常に内蔵サーバ）
   */
  async start(projectRoot: string, port = 8780, options?: { preferScript?: boolean }): Promise<DevServerStatus> {
    await this.stop();

    const scriptPath = path.join(projectRoot, 'scripts', 'serve-local.mjs');
    if (options?.preferScript && fs.existsSync(scriptPath)) {
      try {
        return await this.startViaScript(projectRoot, scriptPath, port);
      } catch (error) {
        this.log.warn('hub', 'script サーバ失敗、内蔵へ切替', String(error));
        await this.stop();
      }
    }
    return this.startBuiltin(projectRoot, port);
  }

  async stop(): Promise<DevServerStatus> {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => resolve());
      });
      this.server = null;
    }
    this.status = {
      running: false,
      port: this.status.port,
      root: null,
      baseUrl: null,
      mode: 'idle',
    };
    this.log.info('hub', '開発サーバを停止しました');
    return this.getStatus();
  }

  private startViaScript(root: string, scriptPath: string, port: number): Promise<DevServerStatus> {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [scriptPath, String(port), '/'], {
        cwd: root,
        shell: true,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.child = child;

      let settled = false;
      const ok = () => {
        if (settled) return;
        settled = true;
        this.status = {
          running: true,
          port,
          root,
          baseUrl: `http://127.0.0.1:${port}`,
          mode: 'script',
        };
        this.log.info('hub', `開発サーバ起動 (script): ${this.status.baseUrl}`);
        resolve(this.getStatus());
      };

      child.stdout?.on('data', (buf: Buffer) => {
        const text = buf.toString();
        if (/listening|http:\/\/|ready|serving/i.test(text) || text.includes(String(port))) {
          ok();
        }
      });
      child.stderr?.on('data', (buf: Buffer) => {
        this.log.warn('hub', 'serve-local stderr', buf.toString().slice(0, 500));
      });
      child.on('error', (err) => {
        if (!settled) {
          settled = true;
          reject(err);
        }
      });
      child.on('exit', (code) => {
        if (!settled) {
          // スクリプトが即終了した場合は内蔵にフォールバックしない（呼び出し側で）
          settled = true;
          reject(new Error(`serve-local.mjs が終了しました (code=${code})`));
        }
        this.child = null;
        if (this.status.mode === 'script') {
          this.status = { ...this.status, running: false, mode: 'idle', baseUrl: null };
        }
      });

      // 出力が無くても短時間後に ready とみなす（多くの実装は起動後すぐ listen）
      setTimeout(ok, 800);
    });
  }

  private startBuiltin(root: string, port: number): Promise<DevServerStatus> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        try {
          const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
          let filePath = this.safeJoin(root, urlPath);
          if (!filePath) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
          }
          if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            filePath = path.join(filePath, 'index.html');
          }
          if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            res.writeHead(404);
            res.end(`Not found: ${urlPath}`);
            return;
          }
          const ext = path.extname(filePath).toLowerCase();
          const data = fs.readFileSync(filePath);
          res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(data);
        } catch (error) {
          res.writeHead(500);
          res.end(error instanceof Error ? error.message : String(error));
        }
      });

      server.once('error', (err) => reject(err));
      server.listen(port, '127.0.0.1', () => {
        this.server = server;
        this.status = {
          running: true,
          port,
          root,
          baseUrl: `http://127.0.0.1:${port}`,
          mode: 'builtin',
        };
        this.log.info('hub', `開発サーバ起動 (builtin): ${this.status.baseUrl}`);
        resolve(this.getStatus());
      });
    });
  }

  private safeJoin(base: string, reqPath: string): string | null {
    const cleaned = path.normalize(reqPath).replace(/^([/\\])+/, '');
    const full = path.join(base, cleaned);
    const resolvedBase = path.resolve(base);
    if (!full.startsWith(resolvedBase)) return null;
    return full;
  }
}
