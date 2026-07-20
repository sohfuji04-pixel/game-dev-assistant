/**
 * Unity Editor WebSocket / JSON-RPC クライアント
 * 既定: ws://127.0.0.1:8765/unity/（Blender は 8775 を使用して衝突回避）
 * 起動時の自動接続はしない。
 */
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { app } from 'electron';
import WebSocket from 'ws';
import type { UnityConnectionStatus } from '../../shared/types/unity';
import type { JsonRpcRequest, JsonRpcResponse } from '../../shared/blender/jsonrpc';
import { isJsonRpcError } from '../../shared/blender/jsonrpc';
import { UnityRpcMethods } from '../../shared/unity/unityMethods';
import type { LogService } from '../logs/LogService';
import type { SettingsService } from '../settings/SettingsService';

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class UnityConnectionService extends EventEmitter {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingCall>();
  private status: UnityConnectionStatus;

  constructor(
    private readonly settings: SettingsService,
    private readonly log: LogService,
  ) {
    super();
    this.status = {
      connected: false,
      state: 'Disconnected',
      url: this.normalizeUrl(settings.get().unityWsUrl),
      projectName: null,
      unityVersion: null,
      activeScene: null,
      lastError: null,
    };
  }

  getStatus(): UnityConnectionStatus {
    return { ...this.status };
  }

  /** パッケージ同梱の Unity Bridge パス（案内用） */
  resolvePackagePath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'unity-package');
    }
    return path.join(process.cwd(), 'src', 'main', 'unity', 'unity-package');
  }

  private normalizeUrl(url: string): string {
    const trimmed = (url || 'ws://127.0.0.1:8765/unity/').trim();
    if (trimmed.endsWith('/unity')) return `${trimmed}/`;
    if (!trimmed.includes('/unity')) {
      const base = trimmed.replace(/\/$/, '');
      return `${base}/unity/`;
    }
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  }

  private setStatus(partial: Partial<UnityConnectionStatus>): void {
    this.status = { ...this.status, ...partial };
    this.emit('status', this.getStatus());
  }

  async connect(): Promise<UnityConnectionStatus> {
    const url = this.normalizeUrl(this.settings.get().unityWsUrl);
    this.setStatus({ url, state: 'Connecting', lastError: null });

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.getStatus();
    }

    this.log.info('unity', 'ブリッジへ接続', url);

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

    this.setStatus({ connected: true, state: 'Connected', lastError: null });
    try {
      await this.call(UnityRpcMethods.ping, {});
      const state = (await this.call(UnityRpcMethods.getState, {})) as {
        projectName?: string;
        unityVersion?: string;
        activeScene?: string;
      };
      this.setStatus({
        projectName: state?.projectName ?? null,
        unityVersion: state?.unityVersion ?? null,
        activeScene: state?.activeScene ?? null,
      });
    } catch (err) {
      this.log.warn('unity', '状態取得失敗', String(err));
    }
    return this.getStatus();
  }

  private bindSocket(ws: WebSocket): void {
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as JsonRpcResponse & { method?: string };
        if (msg.id == null) {
          // notification
          return;
        }
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
        this.log.error('unity', '不正な JSON-RPC', String(err));
      }
    });

    ws.on('close', () => {
      this.setStatus({ connected: false, state: 'Disconnected' });
      this.rejectAllPending('Unity 接続が切断されました');
      this.ws = null;
    });

    ws.on('error', (err) => {
      this.setStatus({ lastError: err.message, state: 'Error' });
      this.log.error('unity', 'WebSocket エラー', err.message);
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus({ connected: false, state: 'Disconnected' });
  }

  async call(method: string, params: Record<string, unknown> = {}, timeoutMs = 60000): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(
        'Unity に接続されていません。Unity で Bridge を開始し、「接続」を実行してください。',
      );
    }
    const id = randomUUID().replace(/-/g, '');
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
    this.log.info('unity', `RPC ${method}`, JSON.stringify(params).slice(0, 200));
    return this.call(method, params);
  }

  /**
   * ダッシュボード用プローブ。
   * 既に接続中ならその状態を返し、未接続なら短時間だけ接続を試す（成功後は切断）。
   */
  async probeConnection(): Promise<import('../../shared/types').ToolConnectionStatus> {
    const checkedAt = new Date().toISOString();
    const url = this.normalizeUrl(this.settings.get().unityWsUrl);
    const editor = this.settings.get().unityEditorPath?.trim() ?? '';

    if (this.status.connected) {
      return {
        ok: true,
        tool: 'unity',
        path: url,
        version: this.status.unityVersion ?? undefined,
        live: true,
        message: `ブリッジ接続中（${this.status.projectName ?? 'Unity'} ${this.status.unityVersion ?? ''}）`,
        checkedAt,
      };
    }

    try {
      await this.connect();
      const version = this.status.unityVersion ?? undefined;
      const project = this.status.projectName ?? undefined;
      await this.disconnect();
      return {
        ok: true,
        tool: 'unity',
        path: url,
        version,
        live: false,
        message: `ブリッジ接続可（${project ?? 'Unity'} ${version ?? ''}）`.trim(),
        checkedAt,
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        tool: 'unity',
        path: editor || url,
        live: false,
        message: `Unity Bridge 未接続（${detail}）。Editor で Start Bridge を実行してください。`,
        checkedAt,
      };
    }
  }

  private rejectAllPending(reason: string): void {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error(reason));
      this.pending.delete(id);
    }
  }
}
