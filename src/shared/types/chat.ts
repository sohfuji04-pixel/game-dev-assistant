/**
 * ChatGPT / AI チャット共有型
 */
export type AiChatMode =
  | 'general'
  | 'gamedev'
  | 'blender'
  | 'unity'
  | 'cursor'
  | 'debug'
  | 'ui'
  | 'imagegen'
  | 'vision';

export interface ChatThread {
  id: string;
  title: string;
  mode: AiChatMode;
  projectPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  status?: 'streaming' | 'done' | 'error' | 'cancelled';
}

export interface ChatStreamEvent {
  threadId: string;
  messageId: string;
  delta?: string;
  content?: string;
  status: 'streaming' | 'done' | 'error' | 'cancelled';
  error?: string;
}
