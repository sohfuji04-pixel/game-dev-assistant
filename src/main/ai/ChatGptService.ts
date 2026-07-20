/**
 * ChatGPT サービス — スレッド永続化・ストリーミング・モード・Memory 注入
 */
import { v4 as uuidv4 } from 'uuid';
import type { AiChatMode, ChatMessage, ChatStreamEvent, ChatThread } from '../../shared/types/chat';
import type { DatabaseService } from '../database/DatabaseService';
import type { LogService } from '../logs/LogService';
import type { AiProviderRouter } from './AiProviderRouter';
import { systemPromptForMode } from './chatModes';
import type { ProjectMemoryService } from './ProjectMemoryService';

export class ChatGptService {
  private readonly abortControllers = new Map<string, AbortController>();

  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AiProviderRouter,
    private readonly memory: ProjectMemoryService,
    private readonly log: LogService,
    private readonly onStream: (event: ChatStreamEvent) => void,
  ) {}

  listThreads(query?: string): ChatThread[] {
    const q = query?.trim();
    if (q) {
      const like = `%${q}%`;
      return this.db
        .all<Record<string, unknown>>(
          `SELECT DISTINCT t.id, t.title, t.mode, t.project_path AS projectPath,
                  t.created_at AS createdAt, t.updated_at AS updatedAt
           FROM chat_threads t
           LEFT JOIN chat_messages m ON m.thread_id = t.id
           WHERE t.title LIKE ? OR m.content LIKE ?
           ORDER BY t.updated_at DESC`,
          [like, like],
        )
        .map((r) => this.mapThread(r));
    }
    return this.db
      .all<Record<string, unknown>>(
        `SELECT id, title, mode, project_path AS projectPath, created_at AS createdAt, updated_at AS updatedAt
         FROM chat_threads ORDER BY updated_at DESC`,
      )
      .map((r) => this.mapThread(r));
  }

  getMessages(threadId: string): ChatMessage[] {
    return this.db
      .all<Record<string, unknown>>(
        `SELECT id, thread_id AS threadId, role, content, created_at AS createdAt, status
         FROM chat_messages WHERE thread_id = ? ORDER BY created_at ASC`,
        [threadId],
      )
      .map((r) => this.mapMessage(r));
  }

  createThread(mode: AiChatMode = 'gamedev', projectPath?: string | null): ChatThread {
    const now = new Date().toISOString();
    const thread: ChatThread = {
      id: uuidv4(),
      title: '新しいチャット',
      mode,
      projectPath: projectPath ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.run(
      `INSERT INTO chat_threads (id, title, mode, project_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [thread.id, thread.title, thread.mode, thread.projectPath, thread.createdAt, thread.updatedAt],
    );
    return thread;
  }

  setMode(threadId: string, mode: AiChatMode): void {
    this.db.run(`UPDATE chat_threads SET mode = ?, updated_at = ? WHERE id = ?`, [
      mode,
      new Date().toISOString(),
      threadId,
    ]);
  }

  deleteThread(threadId: string): void {
    this.abortControllers.get(threadId)?.abort();
    this.abortControllers.delete(threadId);
    this.db.run(`DELETE FROM chat_messages WHERE thread_id = ?`, [threadId]);
    this.db.run(`DELETE FROM chat_threads WHERE id = ?`, [threadId]);
  }

  async stop(threadId: string): Promise<void> {
    this.abortControllers.get(threadId)?.abort();
  }

  async send(
    threadId: string,
    content: string,
    projectPath?: string | null,
  ): Promise<ChatMessage> {
    const text = content.trim();
    if (!text) throw new Error('メッセージが空です');

    const thread = this.requireThread(threadId);
    const now = new Date().toISOString();

    const userMsg: ChatMessage = {
      id: uuidv4(),
      threadId,
      role: 'user',
      content: text,
      createdAt: now,
      status: 'done',
    };
    this.insertMessage(userMsg);

    if (thread.title === '新しいチャット') {
      const title = text.slice(0, 40) + (text.length > 40 ? '…' : '');
      this.db.run(`UPDATE chat_threads SET title = ? WHERE id = ?`, [title, threadId]);
    }

    const assistantId = uuidv4();
    const assistant: ChatMessage = {
      id: assistantId,
      threadId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      status: 'streaming',
    };
    this.insertMessage(assistant);
    this.onStream({
      threadId,
      messageId: assistantId,
      content: '',
      status: 'streaming',
    });

    const controller = new AbortController();
    this.abortControllers.set(threadId, controller);

    try {
      const provider = this.ai.requireOpenAi();
      const mem =
        this.memory.getByProjectPath(projectPath || thread.projectPath || '') ||
        this.memory.seedPokopokoIfNeeded(projectPath || thread.projectPath || '');
      const memoryBlock = this.memory.toContextBlock(mem);
      const system = [systemPromptForMode(thread.mode), memoryBlock].filter(Boolean).join('\n\n');

      const history = this.getMessages(threadId)
        .filter((m) => m.id !== assistantId && m.role !== 'system')
        .slice(-20)
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      const full = await provider.streamChat(
        {
          model: this.ai.getModel(),
          messages: [{ role: 'system', content: system }, ...history],
          signal: controller.signal,
        },
        (delta) => {
          assistant.content += delta;
          this.onStream({
            threadId,
            messageId: assistantId,
            delta,
            content: assistant.content,
            status: 'streaming',
          });
        },
      );

      if (controller.signal.aborted) {
        assistant.status = 'cancelled';
        if (!assistant.content) assistant.content = '（停止されました）';
      } else {
        assistant.content = full || assistant.content || '（応答なし）';
        assistant.status = 'done';
      }
      this.updateMessage(assistant);
      this.touchThread(threadId);
      this.onStream({
        threadId,
        messageId: assistantId,
        content: assistant.content,
        status: assistant.status,
      });
      return assistant;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assistant.status = controller.signal.aborted ? 'cancelled' : 'error';
      assistant.content = assistant.content || `エラー: ${message}`;
      this.updateMessage(assistant);
      this.log.error('chatgpt', message);
      this.onStream({
        threadId,
        messageId: assistantId,
        content: assistant.content,
        status: assistant.status,
        error: message,
      });
      return assistant;
    } finally {
      this.abortControllers.delete(threadId);
    }
  }

  async regenerate(threadId: string, projectPath?: string | null): Promise<ChatMessage> {
    const messages = this.getMessages(threadId);
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) throw new Error('再生成するユーザーメッセージがありません');

    // 末尾の assistant を削除して再送
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') {
      this.db.run(`DELETE FROM chat_messages WHERE id = ?`, [last.id]);
    }
    return this.send(threadId, lastUser.content, projectPath);
  }

  private requireThread(id: string): ChatThread {
    const row = this.db.get<Record<string, unknown>>(
      `SELECT id, title, mode, project_path AS projectPath, created_at AS createdAt, updated_at AS updatedAt
       FROM chat_threads WHERE id = ?`,
      [id],
    );
    if (!row) throw new Error('スレッドが見つかりません');
    return this.mapThread(row);
  }

  private insertMessage(msg: ChatMessage): void {
    this.db.run(
      `INSERT INTO chat_messages (id, thread_id, role, content, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [msg.id, msg.threadId, msg.role, msg.content, msg.createdAt, msg.status ?? 'done'],
    );
  }

  private updateMessage(msg: ChatMessage): void {
    this.db.run(`UPDATE chat_messages SET content = ?, status = ? WHERE id = ?`, [
      msg.content,
      msg.status ?? 'done',
      msg.id,
    ]);
  }

  private touchThread(threadId: string): void {
    this.db.run(`UPDATE chat_threads SET updated_at = ? WHERE id = ?`, [
      new Date().toISOString(),
      threadId,
    ]);
  }

  private mapThread(row: Record<string, unknown>): ChatThread {
    return {
      id: String(row.id),
      title: String(row.title),
      mode: (row.mode as AiChatMode) || 'general',
      projectPath: row.projectPath ? String(row.projectPath) : null,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    };
  }

  private mapMessage(row: Record<string, unknown>): ChatMessage {
    return {
      id: String(row.id),
      threadId: String(row.threadId),
      role: row.role as ChatMessage['role'],
      content: String(row.content ?? ''),
      createdAt: String(row.createdAt),
      status: (row.status as ChatMessage['status']) || 'done',
    };
  }
}
