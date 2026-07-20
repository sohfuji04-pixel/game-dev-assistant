/**
 * AI プロバイダルータ（当面 OpenAI）
 */
import type { SecretStore } from '../security/SecretStore';
import { SECRET_OPENAI_KEY } from '../security/SecretStore';
import type { SettingsService } from '../settings/SettingsService';
import { OpenAiProvider } from './providers/OpenAiProvider';
import type { AiProvider } from './providers/types';

export class AiProviderRouter {
  constructor(
    private readonly secrets: SecretStore,
    private readonly settings: SettingsService,
  ) {}

  getOpenAiKey(): string {
    const fromSecret = this.secrets.get(SECRET_OPENAI_KEY);
    if (fromSecret) return fromSecret;
    // 移行前の平文設定フォールバック
    return this.settings.get().openaiApiKey?.trim() ?? '';
  }

  getModel(): string {
    return this.settings.get().openaiModel?.trim() || 'gpt-4.1';
  }

  requireOpenAi(): AiProvider {
    const key = this.getOpenAiKey();
    if (!key) {
      throw new Error('OpenAI APIキーが未設定です。設定画面で入力してください。');
    }
    return new OpenAiProvider(key);
  }

  hasOpenAiKey(): boolean {
    return Boolean(this.getOpenAiKey());
  }
}
