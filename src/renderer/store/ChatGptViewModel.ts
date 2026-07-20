/**
 * ChatGPT ViewModel
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

export class ChatGptViewModel extends ViewModelBase {
  threads: ChatThread[] = [];
  messages: ChatMessage[] = [];
  activeThreadId: string | null = null;
  mode: AiChatMode = 'gamedev';
  draft = '';
  search = '';
  busy = false;
  message = '';
  private unsub: (() => void) | null = null;

  constructor(private readonly app: AppViewModel) {
    super();
  }

  get projectPath(): string | null {
    return this.app.currentProject?.path ?? null;
  }

  get activeThread(): ChatThread | null {
    return this.threads.find((t) => t.id === this.activeThreadId) ?? null;
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
  }

  async refreshThreads(): Promise<void> {
    this.threads = await ApiClient.chatThreads(this.search || undefined);
    this.notify();
  }

  setSearch(value: string): void {
    this.search = value;
    this.notify();
    void this.refreshThreads();
  }

  setDraft(value: string): void {
    this.draft = value;
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
    // 先行表示
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
      this.message = error instanceof Error ? error.message : String(error);
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
      this.message = error instanceof Error ? error.message : String(error);
      this.busy = false;
    }
    this.notify();
  }

  async copy(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
    this.message = 'コピーしました';
    this.notify();
  }
}
