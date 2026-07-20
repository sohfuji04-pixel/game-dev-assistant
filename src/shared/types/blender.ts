/**
 * Blender AI 共有 DTO（チャット / 接続状態）
 */
export interface BlenderConnectionStatus {
  connected: boolean;
  blenderVersion: string | null;
  host: string;
  port: number;
  lastError: string | null;
  pid: number | null;
}

export interface BlenderChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: string;
  toolCalls?: BlenderToolCall[];
  status?: 'pending' | 'running' | 'done' | 'error' | 'cancelled';
  progress?: number;
  codeBlocks?: Array<{ language: string; code: string }>;
}

export interface BlenderToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

export interface BlenderTemplateInfo {
  id: string;
  label: string;
  description: string;
  category: string;
}
