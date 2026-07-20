/**
 * AI プロバイダ共通インターフェース（将来の差し替え用）
 */
export interface ChatMessageInput {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionParams {
  model: string;
  messages: ChatMessageInput[];
  signal?: AbortSignal;
}

export interface AiProvider {
  readonly id: string;
  streamChat(
    params: ChatCompletionParams,
    onDelta: (text: string) => void,
  ): Promise<string>;
  completeChat(params: ChatCompletionParams): Promise<string>;
}
