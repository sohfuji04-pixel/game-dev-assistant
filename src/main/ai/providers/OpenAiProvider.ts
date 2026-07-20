/**
 * OpenAI Chat Completions プロバイダ（ストリーミング対応）
 */
import OpenAI from 'openai';
import type { AiProvider, ChatCompletionParams } from './types';

export class OpenAiProvider implements AiProvider {
  readonly id = 'openai';

  constructor(private readonly apiKey: string) {}

  async streamChat(
    params: ChatCompletionParams,
    onDelta: (text: string) => void,
  ): Promise<string> {
    const client = new OpenAI({ apiKey: this.apiKey });
    const stream = await client.chat.completions.create(
      {
        model: params.model,
        messages: params.messages,
        stream: true,
      },
      { signal: params.signal },
    );

    let full = '';
    for await (const chunk of stream) {
      if (params.signal?.aborted) break;
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        full += delta;
        onDelta(delta);
      }
    }
    return full;
  }

  async completeChat(params: ChatCompletionParams): Promise<string> {
    const client = new OpenAI({ apiKey: this.apiKey });
    const res = await client.chat.completions.create(
      {
        model: params.model,
        messages: params.messages,
      },
      { signal: params.signal },
    );
    return res.choices[0]?.message?.content?.trim() ?? '';
  }
}
