/**
 * Blender WebSocket / JSON-RPC クライアント
 * - 接続・切断検知・自動再接続
 * - バージョン確認（RPC）
 * - Blender 手動起動（自動起動は設定でオフ既定）
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import WebSocket from 'ws';
import type { BlenderConnectionStatus } from '../../shared/types/blender';
import type { JsonRpcRequest, JsonRpcResponse } from '../../shared/blender/jsonrpc';
import { isJsonRpcError } from '../../shared/blender/jsonrpc';
import type { LogService } from '../logs/LogService';
import type { SettingsService } from '../settings/SettingsService';

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class BlenderConnectionService extends EventEmitter {
  private ws: WebSocket | null = null;
  private child: ChildProcess | null = null;
  private pending = new Map<string, PendingCall>();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private intentionalClose = false;
  private status: BlenderConnectionStatus;

  constructor(
    private readonly settings: SettingsService,
    private readonly log: LogService,
  ) {
    super();
    const s = settings.get();
    this.status = {
      connected: false,
      blenderVersion: null,
      host: s.blenderHost || '127.0.0.1',
      port: s.blenderPort || 8775,
      lastError: null,
      pid: null,
    };
  }

  getStatus(): BlenderConnectionStatus {
    return { ...this.status };
  }

  /** パッケージ内 / 開発時の Python ブリッジパス */
  resolveBootstrapPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'blender-addon', 'bootstrap.py');
    }
    return path.join(process.cwd(), 'src', 'main', 'blender', 'python', 'bootstrap.py');
  }

  private setStatus(partial: Partial<BlenderConnectionStatus>): void {
    this.status = { ...this.status, ...partial };
    this.emit('status', this.getStatus());
  }

  async connect(): Promise<BlenderConnectionStatus> {
    this.intentionalClose = false;
    const s = this.settings.get();
    const host = s.blenderHost || '127.0.0.1';
    const port = s.blenderPort || 8775;
    this.setStatus({ host, port, lastError: null });

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.getStatus();
    }

    const url = `ws://${host}:${port}`;
    this.log.info('blender', 'ブリッジへ接続', url);

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const onOpen = () => {
        cleanup();
        this.ws = ws;
        this.bindSocket(ws);
        resolve();
      };
      const cleanup = () => {
        ws.off('open', onOpen);
        ws.off('error', onError);
      };
      ws.once('open', onOpen);
      ws.once('error', onError);
      setTimeout(() => {
        cleanup();
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        reject(new Error(`接続タイムアウト: ${url}`));
      }, 8000);
    });

    this.setStatus({ connected: true, lastError: null });
    try {
      const version = (await this.call('system.version', {})) as { version?: string };
      this.setStatus({ blenderVersion: version?.version ?? 'unknown' });
    } catch (err) {
      this.log.warn('blender', 'バージョン確認失敗', String(err));
    }
    return this.getStatus();
  }

  private bindSocket(ws: WebSocket): void {
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as JsonRpcResponse;
        if (msg.id == null) return;
        const pending = this.pending.get(String(msg.id));
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(String(msg.id));
        if (isJsonRpcError(msg)) {
          pending.reject(new Error(msg.error.message));
        } else {
          pending.resolve(msg.result);
        }
      } catch (err) {
        this.log.error('blender', '不正な JSON-RPC', String(err));
      }
    });

    ws.on('close', () => {
      this.setStatus({ connected: false });
      this.rejectAllPending('Blender 接続が切断されました');
      this.ws = null;
      if (!this.intentionalClose && this.settings.get().autoReconnectBlender) {
        this.scheduleReconnect();
      }
    });

    ws.on('error', (err) => {
      this.setStatus({ lastError: err.message });
      this.log.error('blender', 'WebSocket エラー', err.message);
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.log.info('blender', '3秒後に再接続します');
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch (err) {
        this.setStatus({
          lastError: err instanceof Error ? err.message : String(err),
        });
        this.scheduleReconnect();
      }
    }, 3000);
  }

  async disconnect(): Promise<void> {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus({ connected: false });
  }

  /**
   * Blender を --python ブリッジ付きで起動し、接続を試みる。
   * 注意: ユーザー操作でのみ呼ぶ（起動時自動起動はしない）
   */
  async launch(): Promise<{ ok: boolean; message: string }> {
    const blenderPath = this.settings.get().blenderExePath?.trim() ?? '';
    if (!blenderPath) {
      return { ok: false, message: '設定で Blender.exe のパスを指定してください' };
    }
    if (!fs.existsSync(blenderPath)) {
      return { ok: false, message: 'Blender.exe が見つかりません' };
    }

    const bootstrap = this.resolveBootstrapPath();
    if (!fs.existsSync(bootstrap)) {
      return { ok: false, message: `ブリッジスクリプトが見つかりません: ${bootstrap}` };
    }

    try {
      const port = this.settings.get().blenderPort || 8775;
      this.child = spawn(blenderPath, ['--python', bootstrap, '--', `--bridge-port=${port}`], {
        detached: false,
        stdio: 'ignore',
      });
      this.setStatus({ pid: this.child.pid ?? null });
      this.child.on('exit', (code) => {
        this.log.info('blender', 'Blender プロセス終了', `code=${code}`);
        this.setStatus({ pid: null });
        this.child = null;
      });

      await new Promise((r) => setTimeout(r, 2500));
      try {
        await this.connect();
      } catch {
        await new Promise((r) => setTimeout(r, 3000));
        await this.connect();
      }
      return { ok: true, message: 'Blender を起動し、ブリッジに接続しました' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus({ lastError: message });
      return { ok: false, message };
    }
  }

  /** exe 存在確認のみ（起動しない） */
  checkExe(): { ok: boolean; path: string; message: string } {
    const exe = this.settings.get().blenderExePath?.trim() ?? '';
    if (!exe) {
      return { ok: false, path: '', message: 'Blender.exe が未設定です' };
    }
    if (!fs.existsSync(exe)) {
      return { ok: false, path: exe, message: '指定パスに Blender.exe が見つかりません' };
    }
    return { ok: true, path: exe, message: 'Blender.exe を確認済み' };
  }

  /**
   * ダッシュボード用プローブ。
   * 既に接続中ならその状態を返し、未接続なら短時間だけ接続を試す（成功後は切断）。
   */
  async probeConnection(): Promise<import('../../shared/types').ToolConnectionStatus> {
    const checkedAt = new Date().toISOString();
    const exe = this.checkExe();
    if (this.status.connected) {
      return {
        ok: true,
        tool: 'blender',
        path: exe.path || `${this.status.host}:${this.status.port}`,
        version: this.status.blenderVersion ?? undefined,
        live: true,
        message: `ブリッジ接続中（${this.status.blenderVersion ?? 'Blender'}）`,
        checkedAt,
      };
    }
    if (!exe.ok) {
      return {
        ok: false,
        tool: 'blender',
        path: exe.path,
        live: false,
        message: exe.message,
        checkedAt,
      };
    }
    try {
      await this.connect();
      const version = this.status.blenderVersion ?? undefined;
      await this.disconnect();
      return {
        ok: true,
        tool: 'blender',
        path: exe.path,
        version,
        live: false,
        message: `exe・ブリッジともに利用可（${version ?? '接続確認済'}）`,
        checkedAt,
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        tool: 'blender',
        path: exe.path,
        live: false,
        message: `exe は見つかったがブリッジ未接続（${detail}）`,
        checkedAt,
      };
    }
  }

  async call(method: string, params: Record<string, unknown> = {}, timeoutMs = 60000): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Blender に接続されていません。先に「接続」または「Blender起動」を実行してください。');
    }
    const id = randomUUID();
    const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC タイムアウト: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.ws!.send(JSON.stringify(request));
    });
  }

  async execute(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    this.log.info('blender', `RPC ${method}`, JSON.stringify(params).slice(0, 200));
    return this.call(method, params);
  }

  private rejectAllPending(reason: string): void {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error(reason));
      this.pending.delete(id);
    }
  }
}
