/**
 * Blender AI チャットオーケストレータ
 * - テンプレート直マッチ（APIキー無しでも動作）
 * - OpenAI Function Calling（キーあり）
 * - 簡易ルールベース fallback
 */
import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import type { BlenderChatMessage, BlenderToolCall } from '../../shared/types/blender';
import { BlenderMethods } from '../../shared/blender/blenderMethods';
import { GAME_TEMPLATES } from '../../shared/blender/templates';
import { buildOpenAITools } from './toolDefinitions';
import type { BlenderConnectionService } from './BlenderConnectionService';
import type { LogService } from '../logs/LogService';
import type { SettingsService } from '../settings/SettingsService';

export class BlenderAIChatService {
  private history: BlenderChatMessage[] = [];
  private cancelled = new Set<string>();

  constructor(
    private readonly settings: SettingsService,
    private readonly blender: BlenderConnectionService,
    private readonly log: LogService,
    private readonly onProgress: (msg: BlenderChatMessage) => void,
  ) {}

  getHistory(): BlenderChatMessage[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  async cancel(messageId: string): Promise<void> {
    this.cancelled.add(messageId);
  }

  async rerun(messageId: string): Promise<BlenderChatMessage> {
    const msg = this.history.find((m) => m.id === messageId && m.role === 'user');
    if (!msg) throw new Error('再実行対象のユーザーメッセージが見つかりません');
    return this.send(msg.content);
  }

  async send(content: string): Promise<BlenderChatMessage> {
    const userMsg: BlenderChatMessage = {
      id: randomUUID(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      status: 'done',
    };
    this.history.push(userMsg);

    const assistantId = randomUUID();
    const assistant: BlenderChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '処理を開始しています…',
      createdAt: new Date().toISOString(),
      status: 'running',
      progress: 0,
      toolCalls: [],
      codeBlocks: [],
    };
    this.history.push(assistant);
    this.onProgress(assistant);

    try {
      const template = this.matchTemplate(content);
      if (template) {
        assistant.progress = 40;
        assistant.content = `テンプレート「${template.label}」を実行します…`;
        this.onProgress({ ...assistant });
        const result = await this.withRetry(() =>
          this.blender.execute('template.run', { key: template.blenderKey }),
        );
        assistant.toolCalls = [
          {
            id: randomUUID(),
            name: 'template.run',
            arguments: { key: template.blenderKey },
            result,
          },
        ];
        assistant.codeBlocks = [{ language: 'json', code: JSON.stringify(result, null, 2) }];
        assistant.content = `「${template.label}」を完了しました。`;
        assistant.status = 'done';
        assistant.progress = 100;
        this.onProgress({ ...assistant });
        this.replace(assistant);
        return assistant;
      }

      const apiKey = this.settings.get().openaiApiKey?.trim();
      if (!apiKey) {
        return this.ruleBasedExecute(content, assistant);
      }

      const client = new OpenAI({ apiKey });
      const tools = buildOpenAITools();
      const completion = await client.chat.completions.create({
        model: this.settings.get().openaiModel || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...this.history
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .slice(-12)
            .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ],
        tools,
        tool_choice: 'auto',
      });

      if (this.cancelled.has(assistantId)) {
        assistant.status = 'cancelled';
        assistant.content = 'キャンセルされました';
        this.onProgress({ ...assistant });
        this.replace(assistant);
        return assistant;
      }

      const choice = completion.choices[0]?.message;
      const toolCalls: BlenderToolCall[] = [];

      if (choice?.tool_calls?.length) {
        const total = choice.tool_calls.length;
        for (let i = 0; i < total; i++) {
          if (this.cancelled.has(assistantId)) {
            assistant.status = 'cancelled';
            break;
          }
          const tc = choice.tool_calls[i];
          const name = tc.function.name;
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments || '{}') as Record<string, unknown>;
          } catch {
            args = {};
          }
          assistant.progress = Math.round(((i + 1) / total) * 90);
          assistant.content = `実行中: ${name} (${i + 1}/${total})`;
          this.onProgress({ ...assistant });

          try {
            const result = await this.withRetry(() => this.blender.execute(name, args));
            toolCalls.push({ id: tc.id, name, arguments: args, result });
          } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            toolCalls.push({ id: tc.id, name, arguments: args, error });
          }
        }
      }

      assistant.toolCalls = toolCalls;
      assistant.codeBlocks = toolCalls.map((t) => ({
        language: 'json',
        code: JSON.stringify(
          { method: t.name, arguments: t.arguments, result: t.result, error: t.error },
          null,
          2,
        ),
      }));
      assistant.content =
        choice?.content ||
        (toolCalls.length
          ? `${toolCalls.length} 件の Blender 操作を実行しました。`
          : '応答を生成できませんでした。');
      assistant.status = assistant.status === 'cancelled' ? 'cancelled' : 'done';
      assistant.progress = 100;
      this.onProgress({ ...assistant });
      this.replace(assistant);
      return assistant;
    } catch (err) {
      assistant.status = 'error';
      assistant.content = `エラー: ${err instanceof Error ? err.message : String(err)}`;
      this.onProgress({ ...assistant });
      this.replace(assistant);
      this.log.error('blender-ai', assistant.content);
      return assistant;
    }
  }

  private matchTemplate(content: string) {
    const normalized = content.trim();
    return GAME_TEMPLATES.find((t) =>
      t.phrases.some((ph) => normalized.includes(ph) || ph.includes(normalized)),
    );
  }

  private async ruleBasedExecute(
    content: string,
    assistant: BlenderChatMessage,
  ): Promise<BlenderChatMessage> {
    const rules: Array<{ test: RegExp; method: string; params: Record<string, unknown> }> = [
      { test: /キューブ|立方体|cube/i, method: BlenderMethods.objectAddCube, params: {} },
      { test: /スフィア|球|sphere/i, method: BlenderMethods.objectAddSphere, params: {} },
      { test: /プレーン|平面|plane/i, method: BlenderMethods.objectAddPlane, params: {} },
      { test: /削除|消して|delete/i, method: BlenderMethods.objectDelete, params: {} },
      { test: /undo|元に戻/i, method: BlenderMethods.undo, params: {} },
      { test: /redo|やり直/i, method: BlenderMethods.redo, params: {} },
      { test: /夜|night/i, method: BlenderMethods.worldSetTimeOfDay, params: { mode: 'night' } },
      { test: /夕焼け|夕|sunset/i, method: BlenderMethods.worldSetTimeOfDay, params: { mode: 'sunset' } },
      { test: /昼|day/i, method: BlenderMethods.worldSetTimeOfDay, params: { mode: 'day' } },
      { test: /fbx/i, method: BlenderMethods.exportFbx, params: {} },
      { test: /gltf|glb/i, method: BlenderMethods.exportGltf, params: {} },
    ];

    const hit = rules.find((r) => r.test.test(content));
    if (!hit) {
      assistant.content =
        'OpenAI APIキーが未設定のため、テンプレートまたは基本コマンドのみ実行できます。設定で APIキーを入力するか、テンプレートから選んでください。';
      assistant.status = 'done';
      assistant.progress = 100;
      this.onProgress({ ...assistant });
      this.replace(assistant);
      return assistant;
    }

    const result = await this.withRetry(() => this.blender.execute(hit.method, hit.params));
    assistant.toolCalls = [{ id: randomUUID(), name: hit.method, arguments: hit.params, result }];
    assistant.codeBlocks = [{ language: 'json', code: JSON.stringify(result, null, 2) }];
    assistant.content = `コマンド ${hit.method} を実行しました。`;
    assistant.status = 'done';
    assistant.progress = 100;
    this.onProgress({ ...assistant });
    this.replace(assistant);
    return assistant;
  }

  private async withRetry<T>(fn: () => Promise<T>, times = 2): Promise<T> {
    let last: unknown;
    for (let i = 0; i <= times; i++) {
      try {
        return await fn();
      } catch (err) {
        last = err;
        this.log.warn('blender-ai', `再試行 ${i + 1}/${times}`, String(err));
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
      }
    }
    throw last;
  }

  private replace(msg: BlenderChatMessage): void {
    const idx = this.history.findIndex((m) => m.id === msg.id);
    if (idx >= 0) this.history[idx] = { ...msg };
  }
}

const SYSTEM_PROMPT = `あなたは Game Dev Assistant 内の Blender AI です。
ユーザーの日本語指示を Blender 操作（function calling）に変換してください。
複数の指示がある場合は順番にツールを呼び出してください。
ゲーム向けテンプレート（牧場少女、羊、世界樹など）は template.run を使います。
存在しないオブジェクトを操作しないでください。必要なら先に作成します。
操作後は簡潔に日本語で結果を説明してください。`;
