/**
 * ChatGPT ViewModel — 返答の反映先指定対応
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type { AppViewModel } from './AppViewModel';
import type { AiChatMode, ChatMessage, ChatThread } from '@shared/types';

export const CHAT_MODE_OPTIONS: Array<{ id: AiChatMode; label: string }> = [
  { id: 'general', label: '一般' },
  { id: 'gamedev', label: 'ゲーム開発' },
  { id: 'blender', label: 'Blender' },
  { id: 'unity', label: 'Unity' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'debug', label: 'デバッグ' },
  { id: 'ui', label: 'UIデザイン' },
  { id: 'imagegen', label: '画像生成' },
  { id: 'vision', label: '画像解析' },
];

const MODE_LABEL = Object.fromEntries(CHAT_MODE_OPTIONS.map((m) => [m.id, m.label])) as Record<
  AiChatMode,
  string
>;

/** GPT 返答の反映先 */
export type ChatApplyTarget = 'clipboard' | 'cursor' | 'blender' | 'unity' | 'file';

export const CHAT_APPLY_TARGETS: Array<{ id: ChatApplyTarget; label: string; hint: string }> = [
  { id: 'clipboard', label: 'クリップボード', hint: '返答テキストをそのままコピーします' },
  { id: 'cursor', label: 'Cursor', hint: 'コピーして Cursor にプロンプトとして送ります' },
  { id: 'blender', label: 'Blender AI', hint: 'Blender AI へ転送し、そのまま実行します' },
  { id: 'unity', label: 'Unity AI', hint: 'Unity AI へ転送し、そのまま実行します' },
  { id: 'file', label: 'プロジェクトファイル', hint: '開いているプロジェクト内の相対パスへ書き込みます' },
];

const STORAGE_TARGET = 'gda.chatgpt.applyTarget';
const STORAGE_FILE = 'gda.chatgpt.applyFilePath';

function readStoredTarget(): ChatApplyTarget {
  try {
    const v = localStorage.getItem(STORAGE_TARGET);
    if (CHAT_APPLY_TARGETS.some((t) => t.id === v)) return v as ChatApplyTarget;
  } catch {
    /* ignore */
  }
  return 'clipboard';
}

function readStoredFilePath(): string {
  try {
    return localStorage.getItem(STORAGE_FILE) || 'ai-output/chatgpt-latest.md';
  } catch {
    return 'ai-output/chatgpt-latest.md';
  }
}

export type BannerKind = 'info' | 'success' | 'error' | 'warn';

export class ChatGptViewModel extends ViewModelBase {
  threads: ChatThread[] = [];
  messages: ChatMessage[] = [];
  activeThreadId: string | null = null;
  mode: AiChatMode = 'gamedev';
  draft = '';
  search = '';
  busy = false;
  applying = false;
  message = '';
  messageKind: BannerKind = 'info';
  /** 反映先 */
  applyTarget: ChatApplyTarget = readStoredTarget();
  /** ファイル反映時の相対パス */
  applyFilePath = readStoredFilePath();
  private unsub: (() => void) | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private bannerTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly app: AppViewModel) {
    super();
  }

  get projectPath(): string | null {
    return this.app.currentProject?.path ?? null;
  }

  get activeThread(): ChatThread | null {
    return this.threads.find((t) => t.id === this.activeThreadId) ?? null;
  }

  get latestAssistantContent(): string | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const m = this.messages[i];
      if (m.role === 'assistant' && m.status !== 'streaming' && m.content.trim()) {
        return m.content;
      }
    }
    return null;
  }

  get applyTargetMeta() {
    return CHAT_APPLY_TARGETS.find((t) => t.id === this.applyTarget) ?? CHAT_APPLY_TARGETS[0];
  }

  get canApplyFile(): boolean {
    return this.applyTarget !== 'file' || Boolean(this.projectPath);
  }

  modeLabel(mode: AiChatMode): string {
    return MODE_LABEL[mode] ?? mode;
  }

  async load(): Promise<void> {
    this.unsub?.();
    this.unsub = ApiClient.onChatStream((event) => {
      if (event.threadId !== this.activeThreadId) return;
      const idx = this.messages.findIndex((m) => m.id === event.messageId);
      if (idx >= 0) {
        this.messages[idx] = {
          ...this.messages[idx],
          content: event.content ?? this.messages[idx].content + (event.delta ?? ''),
          status: event.status,
        };
      } else if (event.content != null) {
        this.messages = [
          ...this.messages,
          {
            id: event.messageId,
            threadId: event.threadId,
            role: 'assistant',
            content: event.content,
            createdAt: new Date().toISOString(),
            status: event.status,
          },
        ];
      }
      if (event.status === 'done' || event.status === 'error' || event.status === 'cancelled') {
        this.busy = false;
        void this.refreshThreads();
      }
      this.notify();
    });
    await this.refreshThreads();
    if (!this.activeThreadId && this.threads[0]) {
      await this.selectThread(this.threads[0].id);
    }
  }

  dispose(): void {
    this.unsub?.();
    this.unsub = null;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
  }

  private setBanner(text: string, kind: BannerKind = 'info', autoClearMs = 0): void {
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.message = text;
    this.messageKind = kind;
    if (autoClearMs > 0) {
      this.bannerTimer = setTimeout(() => {
        if (this.message === text) {
          this.message = '';
          this.notify();
        }
      }, autoClearMs);
    }
  }

  async refreshThreads(): Promise<void> {
    this.threads = await ApiClient.chatThreads(this.search || undefined);
    this.notify();
  }

  setSearch(value: string): void {
    this.search = value;
    this.notify();
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      void this.refreshThreads();
    }, 220);
  }

  setDraft(value: string): void {
    this.draft = value;
    this.notify();
  }

  setApplyTarget(target: ChatApplyTarget): void {
    this.applyTarget = target;
    try {
      localStorage.setItem(STORAGE_TARGET, target);
    } catch {
      /* ignore */
    }
    this.notify();
  }

  setApplyFilePath(value: string): void {
    this.applyFilePath = value;
    try {
      localStorage.setItem(STORAGE_FILE, value);
    } catch {
      /* ignore */
    }
    this.notify();
  }

  async newChat(): Promise<void> {
    const thread = await ApiClient.chatCreate(this.mode, this.projectPath);
    this.threads = [thread, ...this.threads];
    this.activeThreadId = thread.id;
    this.messages = [];
    this.notify();
  }

  async selectThread(id: string): Promise<void> {
    this.activeThreadId = id;
    this.messages = await ApiClient.chatMessages(id);
    const t = this.threads.find((x) => x.id === id);
    if (t) this.mode = t.mode;
    this.notify();
  }

  async setMode(mode: AiChatMode): Promise<void> {
    this.mode = mode;
    if (this.activeThreadId) {
      await ApiClient.chatSetMode(this.activeThreadId, mode);
      await this.refreshThreads();
    }
    this.notify();
  }

  async deleteActive(): Promise<void> {
    if (!this.activeThreadId) return;
    const id = this.activeThreadId;
    await ApiClient.chatDelete(id);
    this.activeThreadId = null;
    this.messages = [];
    await this.refreshThreads();
    if (this.threads[0]) await this.selectThread(this.threads[0].id);
    this.notify();
  }

  async send(): Promise<void> {
    const text = this.draft.trim();
    if (!text || this.busy) return;
    if (!this.activeThreadId) await this.newChat();
    const threadId = this.activeThreadId!;
    this.draft = '';
    this.busy = true;
    this.message = '';
    this.messages = [
      ...this.messages,
      {
        id: `local-${Date.now()}`,
        threadId,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
        status: 'done',
      },
    ];
    this.notify();
    try {
      await ApiClient.chatSend(threadId, text, this.projectPath);
      this.messages = await ApiClient.chatMessages(threadId);
      await this.refreshThreads();
    } catch (error) {
      this.setBanner(error instanceof Error ? error.message : String(error), 'error');
      this.busy = false;
      this.messages = await ApiClient.chatMessages(threadId);
    }
    this.notify();
  }

  async stop(): Promise<void> {
    if (!this.activeThreadId) return;
    await ApiClient.chatStop(this.activeThreadId);
    this.busy = false;
    this.notify();
  }

  async regenerate(): Promise<void> {
    if (!this.activeThreadId || this.busy) return;
    this.busy = true;
    this.notify();
    try {
      await ApiClient.chatRegenerate(this.activeThreadId, this.projectPath);
      this.messages = await ApiClient.chatMessages(this.activeThreadId);
    } catch (error) {
      this.setBanner(error instanceof Error ? error.message : String(error), 'error');
      this.busy = false;
    }
    this.notify();
  }

  async copy(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
    this.setBanner('コピーしました', 'success', 2200);
    this.notify();
  }

  /** 最新の AI 返答を反映 */
  async applyLatest(): Promise<void> {
    const content = this.latestAssistantContent;
    if (!content) {
      this.setBanner('反映できる AI 返答がありません', 'warn', 2800);
      this.notify();
      return;
    }
    await this.applyContent(content);
  }

  /** 指定テキストを反映先へそのまま送る */
  async applyContent(content: string): Promise<void> {
    const text = content.trim();
    if (!text || this.applying) return;
    this.applying = true;
    this.message = '';
    this.notify();
    try {
      switch (this.applyTarget) {
        case 'clipboard':
          await navigator.clipboard.writeText(text);
          this.setBanner('クリップボードへ反映しました', 'success', 2500);
          break;
        case 'cursor': {
          await navigator.clipboard.writeText(text);
          const res = await ApiClient.cursorSendPrompt(text, this.projectPath ?? undefined);
          if (res.success) {
            this.setBanner('Cursor へ反映しました（履歴保存・起動。必要なら貼り付け）', 'success', 3500);
          } else {
            this.setBanner(res.message, 'warn', 4000);
          }
          break;
        }
        case 'blender': {
          await ApiClient.blenderChatSend(text);
          this.app.setPage('blender');
          this.app.flashMessage('ChatGPT の返答を Blender AI へ反映して実行しました');
          break;
        }
        case 'unity': {
          await ApiClient.unityChatSend(text);
          this.app.setPage('unity');
          this.app.flashMessage('ChatGPT の返答を Unity AI へ反映して実行しました');
          break;
        }
        case 'file': {
          const root = this.projectPath;
          if (!root) {
            this.setBanner('ファイル反映にはプロジェクトを開いてください', 'warn', 3500);
            break;
          }
          const rel = this.applyFilePath.trim() || 'ai-output/chatgpt-latest.md';
          const res = await ApiClient.projectWriteText({
            projectRoot: root,
            relativePath: rel,
            content: text,
          });
          this.setBanner(res.message, res.success ? 'success' : 'error', res.success ? 3200 : 0);
          break;
        }
        default:
          this.setBanner('未対応の反映先です', 'error');
      }
    } catch (error) {
      this.setBanner(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      this.applying = false;
      this.notify();
    }
  }
}
