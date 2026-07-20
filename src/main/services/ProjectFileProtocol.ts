/**
 * プロジェクトファイルをポート無しで配信するカスタムプロトコル
 * URL: gda-project://workspace/<相対パス>
 */
import { protocol, net } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { LogService } from '../logs/LogService';

export const PROJECT_PROTOCOL = 'gda-project';
const HOST = 'workspace';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
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
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

/** app.ready より前に一度だけ呼ぶ */
export function registerProjectProtocolPrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PROJECT_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        bypassCSP: true,
      },
    },
  ]);
}

export class ProjectFileProtocol {
  private root: string | null = null;
  private registered = false;

  constructor(private readonly log: LogService) {}

  /** app.whenReady 後にハンドラ登録 */
  registerHandler(): void {
    if (this.registered) return;
    protocol.handle(PROJECT_PROTOCOL, (request) => this.handleRequest(request));
    this.registered = true;
    this.log.info('hub', `${PROJECT_PROTOCOL}:// プロトコルを登録しました`);
  }

  setProjectRoot(projectRoot: string | null): void {
    this.root = projectRoot ? path.resolve(projectRoot) : null;
  }

  getProjectRoot(): string | null {
    return this.root;
  }

  /** 相対 HTML パス → アプリ内 URL（ポート不要） */
  toAppUrl(htmlPath: string): string {
    const normalized = htmlPath.replace(/\\/g, '/').replace(/^\/+/, '');
    return `${PROJECT_PROTOCOL}://${HOST}/${normalized}`;
  }

  private async handleRequest(request: Request): Promise<Response> {
    try {
      if (!this.root) {
        return new Response('プロジェクトが未選択です', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }

      const url = new URL(request.url);
      let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      // 一部環境ではホストがパスに含まれる
      if (rel.startsWith(`${HOST}/`)) {
        rel = rel.slice(HOST.length + 1);
      }

      let filePath = this.safeJoin(this.root, rel || 'index.html');
      if (!filePath) {
        return new Response('Forbidden', { status: 403 });
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return new Response(`Not found: ${rel}`, {
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }

      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      const fileUrl = pathToFileURL(filePath).href;
      const res = await net.fetch(fileUrl);
      const headers = new Headers(res.headers);
      headers.set('Content-Type', mime);
      headers.set('Cache-Control', 'no-cache');
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.error('hub', 'プロトコル配信エラー', message);
      return new Response(message, {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }

  private safeJoin(base: string, reqPath: string): string | null {
    const cleaned = path.normalize(reqPath).replace(/^([/\\])+/, '');
    const full = path.resolve(base, cleaned);
    const resolvedBase = path.resolve(base);
    const prefix = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep;
    if (full !== resolvedBase && !full.toLowerCase().startsWith(prefix.toLowerCase())) {
      return null;
    }
    return full;
  }
}
