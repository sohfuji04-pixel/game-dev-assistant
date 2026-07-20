/**
 * プロジェクト内の静的ファイルを配信する開発サーバ
 * ぽこぽこの serve-local.mjs 相当を Electron 内に内蔵する。
 */
import http from 'node:http';
import net from 'node:net';
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

const DEFAULT_PORT = 8780;
const PORT_ATTEMPTS = 20;

export interface DevServerStatus {
  running: boolean;
  port: number;
  root: string | null;
  baseUrl: string | null;
  mode: 'builtin' | 'script' | 'idle';
}

function isAddrInUse(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'EADDRINUSE');
}

export class DevServerService {
  private server: http.Server | null = null;
  private child: ChildProcess | null = null;
  private status: DevServerStatus = {
    running: false,
    port: DEFAULT_PORT,
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
  async start(projectRoot: string, port = DEFAULT_PORT, options?: { preferScript?: boolean }): Promise<DevServerStatus> {
    await this.stop();
    // Windows で listen 解除が遅れることがあるため短く待つ
    await sleep(150);

    const scriptPath = path.join(projectRoot, 'scripts', 'serve-local.mjs');
    if (options?.preferScript && fs.existsSync(scriptPath)) {
      try {
        const freePort = await this.findFreePort(port);
        return await this.startViaScript(projectRoot, scriptPath, freePort);
      } catch (error) {
        this.log.warn('hub', 'script サーバ失敗、内蔵へ切替', String(error));
        await this.stop();
        await sleep(150);
      }
    }
    return this.startBuiltinWithFallback(projectRoot, port);
  }

  async stop(): Promise<DevServerStatus> {
    if (this.child) {
      try {
        this.child.kill();
      } catch {
        /* ignore */
      }
      this.child = null;
    }
    if (this.server) {
      const server = this.server;
      this.server = null;
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        // Node 18.2+: 既存接続を切ってポート解放を早める
        if (typeof (server as http.Server & { closeAllConnections?: () => void }).closeAllConnections === 'function') {
          (server as http.Server & { closeAllConnections: () => void }).closeAllConnections();
        }
        server.close(() => done());
        setTimeout(done, 500);
      });
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

  private async findFreePort(startPort: number): Promise<number> {
    for (let i = 0; i < PORT_ATTEMPTS; i++) {
      const port = startPort + i;
      if (await this.canListen(port)) return port;
    }
    throw new Error(`ポート ${startPort}〜${startPort + PORT_ATTEMPTS - 1} がすべて使用中です`);
  }

  private canListen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const tester = net.createServer();
      tester.once('error', () => resolve(false));
      tester.once('listening', () => {
        tester.close(() => resolve(true));
      });
      tester.listen(port, '127.0.0.1');
    });
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
          settled = true;
          reject(new Error(`serve-local.mjs が終了しました (code=${code})`));
        }
        this.child = null;
        if (this.status.mode === 'script') {
          this.status = { ...this.status, running: false, mode: 'idle', baseUrl: null };
        }
      });

      setTimeout(ok, 800);
    });
  }

  private async startBuiltinWithFallback(root: string, startPort: number): Promise<DevServerStatus> {
    let lastError: unknown;
    for (let i = 0; i < PORT_ATTEMPTS; i++) {
      const port = startPort + i;
      try {
        return await this.startBuiltin(root, port);
      } catch (err) {
        lastError = err;
        if (!isAddrInUse(err)) throw err;
        this.log.warn('hub', `ポート ${port} は使用中です。次のポートを試します`);
      }
    }
    const msg =
      lastError instanceof Error
        ? lastError.message
        : `ポート ${startPort} 付近がすべて使用中です`;
    throw new Error(
      `開発サーバを起動できません（${msg}）。他の Game Dev Assistant / npm run hub を終了するか、「配信停止」後に再試行してください。`,
    );
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

      const onError = (err: Error) => {
        server.off('error', onError);
        try {
          server.close();
        } catch {
          /* ignore */
        }
        reject(err);
      };

      server.once('error', onError);
      server.listen(port, '127.0.0.1', () => {
        server.off('error', onError);
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
