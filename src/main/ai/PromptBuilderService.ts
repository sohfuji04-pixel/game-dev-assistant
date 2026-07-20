/**
 * Prompt Builder — Cursor 向け高品質プロンプト生成
 */
import type { AiProviderRouter } from './AiProviderRouter';
import type { ProjectMemoryService } from './ProjectMemoryService';
import type { LogService } from '../logs/LogService';

export class PromptBuilderService {
  constructor(
    private readonly ai: AiProviderRouter,
    private readonly memory: ProjectMemoryService,
    private readonly log: LogService,
  ) {}

  async generate(input: {
    gameContent: string;
    workContent: string;
    language: string;
    projectPath?: string | null;
  }): Promise<string> {
    const provider = this.ai.requireOpenAi();
    const mem = input.projectPath
      ? this.memory.getByProjectPath(input.projectPath) ||
        this.memory.seedPokopokoIfNeeded(input.projectPath)
      : null;
    const memoryBlock = this.memory.toContextBlock(mem);

    const system = `あなたは Cursor / AI コーディングエージェント向けのプロンプト設計の専門家です。
与えられたゲーム内容・作業内容・使用言語から、エージェントが誤解なく実行できる最高品質の実装指示プロンプトを日本語で生成してください。
含める要素: 目的、前提、制約、手順、完了条件、触ってはいけない範囲、出力形式。
プロンプト本文のみを出力し、前置きは不要です。`;

    const user = [
      memoryBlock,
      `【ゲーム内容】\n${input.gameContent.trim() || '（未指定）'}`,
      `【作業内容】\n${input.workContent.trim() || '（未指定）'}`,
      `【使用言語】\n${input.language.trim() || '（未指定）'}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      return await provider.completeChat({
        model: this.ai.getModel(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.error('prompt-builder', message);
      throw error;
    }
  }
}
