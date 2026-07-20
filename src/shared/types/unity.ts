/**
 * Unity AI 共有 DTO
 */
export interface UnityConnectionStatus {
  connected: boolean;
  state: 'Disconnected' | 'Connecting' | 'Connected' | 'Error';
  url: string;
  projectName: string | null;
  unityVersion: string | null;
  activeScene: string | null;
  lastError: string | null;
}

export interface UnityChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  status?: 'pending' | 'running' | 'done' | 'error';
  codeBlocks?: Array<{ language: string; code: string }>;
}

export interface UnityQuickCommand {
  id: string;
  label: string;
  description: string;
  /** チャットに流す自然言語、または直接 RPC */
  phrase?: string;
  method?: string;
  params?: Record<string, unknown>;
}
