/**
 * Unity AI チャット（ルールベース NL → RPC）
 * OpenAI キーがあれば簡易フォールバックとして説明のみ拡張可能。
 */
import { randomUUID } from 'node:crypto';
import type { UnityChatMessage } from '../../shared/types/unity';
import { UnityRpcMethods } from '../../shared/unity/unityMethods';
import type { UnityConnectionService } from './UnityConnectionService';
import type { LogService } from '../logs/LogService';
import type { SettingsService } from '../settings/SettingsService';
import OpenAI from 'openai';

export interface UnityIntent {
  method: string;
  params: Record<string, unknown>;
  confidence: number;
  explanation: string;
}

export class UnityAIChatService {
  private history: UnityChatMessage[] = [];

  constructor(
    private readonly settings: SettingsService,
    private readonly unity: UnityConnectionService,
    private readonly log: LogService,
    private readonly onProgress: (msg: UnityChatMessage) => void,
    private readonly getApiKey: () => string = () => this.settings.get().openaiApiKey?.trim() ?? '',
  ) {}

  getHistory(): UnityChatMessage[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  async send(content: string): Promise<UnityChatMessage> {
    const userMsg: UnityChatMessage = {
      id: randomUUID(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      status: 'done',
    };
    this.history.push(userMsg);

    const assistant: UnityChatMessage = {
      id: randomUUID(),
      role: 'assistant',
      content: '解釈中…',
      createdAt: new Date().toISOString(),
      status: 'running',
      codeBlocks: [],
    };
    this.history.push(assistant);
    this.onProgress(assistant);

    try {
      const intent = this.parseIntent(content);
      if (!intent || intent.confidence < 0.55) {
        const apiKey = this.getApiKey();
        if (apiKey) {
          assistant.content = await this.explainWithOpenAI(content, apiKey);
          assistant.status = 'done';
          this.onProgress({ ...assistant });
          this.replace(assistant);
          return assistant;
        }
        assistant.content =
          '指示を解釈できませんでした。例: 「プレイヤーを追加」「敵を10体生成」「シーンを保存」「タイトル画面を作成」';
        assistant.status = 'done';
        this.onProgress({ ...assistant });
        this.replace(assistant);
        return assistant;
      }

      assistant.content = `${intent.explanation} 実行します…`;
      this.onProgress({ ...assistant });

      const result = await this.unity.execute(intent.method, intent.params);
      assistant.codeBlocks = [
        {
          language: 'json',
          code: JSON.stringify({ method: intent.method, params: intent.params, result }, null, 2),
        },
      ];
      assistant.content = `${intent.explanation}\n完了しました。`;
      assistant.status = 'done';
      this.onProgress({ ...assistant });
      this.replace(assistant);
      return assistant;
    } catch (err) {
      assistant.status = 'error';
      assistant.content = `エラー: ${err instanceof Error ? err.message : String(err)}`;
      this.onProgress({ ...assistant });
      this.replace(assistant);
      this.log.error('unity-ai', assistant.content);
      return assistant;
    }
  }

  /** ルールベース NL → RPC（UnityAIController RuleBasedIntentParser 相当） */
  parseIntent(naturalLanguage: string): UnityIntent | null {
    const text = naturalLanguage.trim();
    const contains = (...ks: string[]) => ks.some((k) => text.toLowerCase().includes(k.toLowerCase()));

    if (contains('タイトル画面', 'メニュー画面', 'メニューを作', 'UIを自動生成', 'uiを自動生成')) {
      return {
        method: UnityRpcMethods.generateMenuUi,
        params: {},
        confidence: 0.95,
        explanation: 'メニュー/タイトル画面の自動生成と判断しました。',
      };
    }

    if (contains('プレイヤー', 'player')) {
      return {
        method: UnityRpcMethods.createGameObject,
        params: {
          name: 'Player',
          primitive: 'Capsule',
          components: ['Rigidbody', 'CapsuleCollider', 'Animator'],
        },
        confidence: 0.92,
        explanation: 'プレイヤー追加と判断しました。',
      };
    }

    const countMatch = text.match(/(\d+)\s*体|(\d+)\s*個|敵を(\d+)|(\d+)\s*enemies?/i);
    if (contains('敵', 'enemy') && countMatch) {
      const count = Number(countMatch[1] || countMatch[2] || countMatch[3] || countMatch[4] || 1);
      return {
        method: UnityRpcMethods.createGameObject,
        params: { name: 'Enemy', primitive: 'Cube', count },
        confidence: 0.93,
        explanation: `敵を ${count} 体生成と判断しました。`,
      };
    }

    if (contains('android') && contains('ビルド', 'build', 'apk')) {
      return {
        method: UnityRpcMethods.buildPlayer,
        params: { target: 'Android' },
        confidence: 0.9,
        explanation: 'Android ビルドと判断しました。',
      };
    }

    if (contains('windows', 'exe') && contains('ビルド', 'build')) {
      return {
        method: UnityRpcMethods.buildPlayer,
        params: { target: 'StandaloneWindows64' },
        confidence: 0.9,
        explanation: 'Windows ビルドと判断しました。',
      };
    }

    if (contains('webgl') && contains('ビルド', 'build')) {
      return {
        method: UnityRpcMethods.buildPlayer,
        params: { target: 'WebGL' },
        confidence: 0.9,
        explanation: 'WebGL ビルドと判断しました。',
      };
    }

    if (contains('シーン保存', 'シーンを保存')) {
      return {
        method: UnityRpcMethods.saveScene,
        params: {},
        confidence: 0.9,
        explanation: 'シーン保存と判断しました。',
      };
    }

    if (contains('プレハブ', 'prefab')) {
      return {
        method: UnityRpcMethods.createPrefab,
        params: { name: 'NewPrefab' },
        confidence: 0.85,
        explanation: 'Prefab 作成と判断しました。',
      };
    }

    if (contains('animator', 'アニメーター')) {
      return {
        method: UnityRpcMethods.createAnimatorController,
        params: { name: 'NewAnimator' },
        confidence: 0.85,
        explanation: 'Animator Controller 生成と判断しました。',
      };
    }

    const componentType = this.inferComponent(text);
    if (componentType) {
      return {
        method: UnityRpcMethods.addComponent,
        params: { componentType },
        confidence: 0.8,
        explanation: `コンポーネント追加（${componentType}）と判断しました。`,
      };
    }

    if (contains('キューブ', 'cube', 'オブジェクト追加', 'gameobject')) {
      return {
        method: UnityRpcMethods.createGameObject,
        params: { name: 'Cube', primitive: 'Cube' },
        confidence: 0.75,
        explanation: 'GameObject 作成と判断しました。',
      };
    }

    if (contains('プロジェクト保存', 'プロジェクトを保存')) {
      return {
        method: UnityRpcMethods.saveProject,
        params: {},
        confidence: 0.85,
        explanation: 'プロジェクト保存と判断しました。',
      };
    }

    return null;
  }

  private inferComponent(text: string): string | null {
    const contains = (...ks: string[]) => ks.some((k) => text.toLowerCase().includes(k.toLowerCase()));
    if (contains('rigidbody')) return 'Rigidbody';
    if (contains('collider')) return 'BoxCollider';
    if (contains('camera', 'カメラ')) return 'Camera';
    if (contains('light', 'ライト')) return 'Light';
    if (contains('canvas', 'キャンバス')) return 'Canvas';
    if (contains('button')) return 'UnityEngine.UI.Button';
    if (contains('tmp', 'textmeshpro')) return 'TMPro.TextMeshProUGUI';
    if (contains('image')) return 'UnityEngine.UI.Image';
    if (contains('animator')) return 'Animator';
    if (contains('audio')) return 'AudioSource';
    return null;
  }

  private async explainWithOpenAI(content: string, apiKey: string): Promise<string> {
    try {
      const client = new OpenAI({ apiKey });
      const res = await client.chat.completions.create({
        model: this.settings.get().openaiModel || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'あなたは Unity 操作アシスタントです。ユーザー指示を実行可能な短い日本語手順に分解してください。実際の Editor 操作は別途ルールベースで行います。',
          },
          { role: 'user', content },
        ],
      });
      return (
        res.choices[0]?.message?.content ||
        'OpenAI で説明を生成しましたが、対応コマンドがありません。クイックコマンドを試してください。'
      );
    } catch (err) {
      return `解釈できませんでした（OpenAI: ${err instanceof Error ? err.message : String(err)}）`;
    }
  }

  private replace(msg: UnityChatMessage): void {
    const idx = this.history.findIndex((m) => m.id === msg.id);
    if (idx >= 0) this.history[idx] = { ...msg };
  }
}
