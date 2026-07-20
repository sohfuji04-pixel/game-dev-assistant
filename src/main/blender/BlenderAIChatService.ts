/**
 * Blender AI チャットオーケストレータ
 * - テンプレート直マッチ（APIキー無しでも動作）
 * - OpenAI Function Calling（キーあり）
 * - 写真からの生成（参照プレーン + Vision 任意）
 * - 簡易ルールベース fallback
 */
import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { BlenderChatMessage, BlenderToolCall } from '../../shared/types/blender';
import { BlenderMethods } from '../../shared/blender/blenderMethods';
import { GAME_TEMPLATES } from '../../shared/blender/templates';
import { buildOpenAITools } from './toolDefinitions';
import type { BlenderConnectionService } from './BlenderConnectionService';
import type { LogService } from '../logs/LogService';
import type { SettingsService } from '../settings/SettingsService';

export type PhotoGenerateMode = 'reference' | 'relief' | 'scene';

export class BlenderAIChatService {
  private history: BlenderChatMessage[] = [];
  private cancelled = new Set<string>();

  constructor(
    private readonly settings: SettingsService,
    private readonly blender: BlenderConnectionService,
    private readonly log: LogService,
    private readonly onProgress: (msg: BlenderChatMessage) => void,
    private readonly getApiKey: () => string = () => this.settings.get().openaiApiKey?.trim() ?? '',
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

  /**
   * 写真から Blender シーンを生成。
   * APIキーがある場合は Vision で内容を推定し、近いテンプレートも実行する。
   */
  async generateFromPhoto(
    imagePath: string,
    mode: PhotoGenerateMode = 'scene',
  ): Promise<BlenderChatMessage> {
    const fileName = path.basename(imagePath);
    const userMsg: BlenderChatMessage = {
      id: randomUUID(),
      role: 'user',
      content: `写真から生成: ${fileName}（mode=${mode}）`,
      createdAt: new Date().toISOString(),
      status: 'done',
    };
    this.history.push(userMsg);

    const assistantId = randomUUID();
    const assistant: BlenderChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '写真を読み込んでいます…',
      createdAt: new Date().toISOString(),
      status: 'running',
      progress: 5,
      toolCalls: [],
      codeBlocks: [],
    };
    this.history.push(assistant);
    this.onProgress(assistant);

    try {
      await fs.access(imagePath);
      const toolCalls: BlenderToolCall[] = [];

      assistant.progress = 25;
      assistant.content = '写真を Blender に配置しています…';
      this.onProgress({ ...assistant });

      const importResult = await this.withRetry(() =>
        this.blender.execute(BlenderMethods.imageGenerateFromPhoto, {
          path: imagePath,
          mode,
          name: 'PhotoPlane',
          standup: true,
        }),
      );
      toolCalls.push({
        id: randomUUID(),
        name: BlenderMethods.imageGenerateFromPhoto,
        arguments: { path: imagePath, mode },
        result: importResult,
      });

      let visionNote = '';
      const apiKey = this.getApiKey();
      if (apiKey) {
        assistant.progress = 55;
        assistant.content = '写真の内容を解析しています…';
        this.onProgress({ ...assistant });

        const client = new OpenAI({ apiKey });
        const analysis = await this.analyzePhoto(client, imagePath);
        visionNote = analysis.description;

        if (analysis.templateKey) {
          const template = GAME_TEMPLATES.find((t) => t.blenderKey === analysis.templateKey);
          if (template) {
            assistant.progress = 75;
            assistant.content = `「${template.label}」テンプレートを追加しています…`;
            this.onProgress({ ...assistant });
            const tplResult = await this.withRetry(() =>
              this.blender.execute(BlenderMethods.templateRun, { key: template.blenderKey }),
            );
            toolCalls.push({
              id: randomUUID(),
              name: BlenderMethods.templateRun,
              arguments: { key: template.blenderKey },
              result: tplResult,
            });
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
      const modeLabel =
        mode === 'reference' ? '参照プレーン' : mode === 'relief' ? '厚み付きプレーン' : 'シーン';
      assistant.content = visionNote
        ? `写真「${fileName}」から ${modeLabel} を生成しました。\n解析: ${visionNote}`
        : `写真「${fileName}」から ${modeLabel} を生成しました。（OpenAI APIキーを設定すると内容解析とテンプレート追加が有効になります）`;
      assistant.status = 'done';
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

  private async analyzePhoto(
    client: OpenAI,
    imagePath: string,
  ): Promise<{ description: string; templateKey: string | null }> {
    const buf = await fs.readFile(imagePath);
    const b64 = buf.toString('base64');
    const ext = path.extname(imagePath).toLowerCase().replace('.', '') || 'jpeg';
    const mime =
      ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    const keys = GAME_TEMPLATES.map((t) => t.blenderKey).join('|');

    const completion = await client.chat.completions.create({
      model: this.settings.get().openaiModel || 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `この写真をゲーム向け 3D にするための短い日本語説明（1〜2文）と、近いテンプレートキーを JSON で返してください。
テンプレートキーは次のいずれか、該当なしは null: ${keys}
形式: {"description":"...","templateKey":"farm_girl"|null}`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mime};base64,${b64}` },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 300,
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    try {
      const parsed = JSON.parse(raw) as { description?: string; templateKey?: string | null };
      const key = parsed.templateKey && GAME_TEMPLATES.some((t) => t.blenderKey === parsed.templateKey)
        ? parsed.templateKey
        : null;
      return {
        description: parsed.description?.trim() || '写真の内容を解析しました。',
        templateKey: key,
      };
    } catch {
      return { description: raw.slice(0, 200) || '写真の内容を解析しました。', templateKey: null };
    }
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

      const apiKey = this.getApiKey();
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
写真からの生成は image.generate_from_photo（path 必須）を使います。
存在しないオブジェクトを操作しないでください。必要なら先に作成します。
操作後は簡潔に日本語で結果を説明してください。`;
