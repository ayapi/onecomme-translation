import { generateText, APICallError } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { AppConfig } from './config.js';
import type { Logger } from './logger.js';

export interface TranslationResult {
  translatedText: string;
  targetLang: string;
  skipped: boolean;
}

export interface TranslationError {
  code: 'TIMEOUT' | 'API_ERROR' | 'UNKNOWN';
  message: string;
}

export type TranslateResult =
  | { ok: true; value: TranslationResult }
  | { ok: false; error: TranslationError };

const LANG_NAME_MAP: Record<string, string> = {
  ja: 'Japanese', en: 'English', ko: 'Korean',
  zh: 'Chinese', es: 'Spanish', fr: 'French',
  de: 'German', pt: 'Portuguese', ru: 'Russian',
  th: 'Thai', vi: 'Vietnamese', id: 'Indonesian',
  ar: 'Arabic', it: 'Italian',
  ja_JP: 'Japanese', en_US: 'English', ko_KR: 'Korean',
  zh_CN: 'Simplified Chinese', zh_TW: 'Traditional Chinese',
};

export function getLangName(code: string): string {
  return LANG_NAME_MAP[code] ?? code;
}

export class TranslationService {
  private config: AppConfig;
  private logger: Logger;

  constructor(config: AppConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async translate(text: string, targetLang: string): Promise<TranslateResult> {
    const langName = getLangName(targetLang);

    try {
      const model = this.createModel();
      const abortController = new AbortController();
      const timer = setTimeout(() => abortController.abort(), this.config.timeout);

      try {
        const { text: result } = await generateText({
          model,
          system: this.config.systemPrompt,
          prompt: `Translate the following text to ${langName}:\n${text}`,
          temperature: 0,
          maxTokens: Math.max(256, text.length * 4),
          abortSignal: abortController.signal,
        });

        clearTimeout(timer);

        const trimmed = result.trim();

        if (trimmed.startsWith('[SAME_LANG]')) {
          this.logger.debug(`Same language detected, skipping: ${targetLang}`);
          return {
            ok: true,
            value: {
              translatedText: text,
              targetLang,
              skipped: true,
            },
          };
        }

        return {
          ok: true,
          value: {
            translatedText: trimmed,
            targetLang,
            skipped: false,
          },
        };
      } finally {
        clearTimeout(timer);
      }
    } catch (err: unknown) {
      return this.handleError(err);
    }
  }

  private createModel() {
    switch (this.config.provider) {
      case 'openai': {
        const openai = createOpenAI({ apiKey: this.config.apiKey });
        return openai(this.config.model);
      }
      case 'anthropic': {
        const anthropic = createAnthropic({ apiKey: this.config.apiKey });
        return anthropic(this.config.model);
      }
      case 'google': {
        const google = createGoogleGenerativeAI({ apiKey: this.config.apiKey });
        return google(this.config.model);
      }
      default:
        throw new Error(`Unknown provider: ${this.config.provider}`);
    }
  }

  private handleError(err: unknown): TranslateResult {
    if (err instanceof Error) {
      if (err.name === 'AbortError' || err.message.includes('abort')) {
        this.logger.error(`Translation timeout: ${err.message}`);
        return {
          ok: false,
          error: { code: 'TIMEOUT', message: err.message },
        };
      }

      // SDK API errors (e.g. 401, 429, 500 from providers)
      if (err instanceof APICallError) {
        this.logger.error(`API error: ${err.statusCode} - ${err.message}`);
        return {
          ok: false,
          error: { code: 'API_ERROR', message: err.message },
        };
      }

      this.logger.error(`Unknown error: ${err.message}`);
      return {
        ok: false,
        error: { code: 'UNKNOWN', message: err.message },
      };
    }

    const message = String(err);
    this.logger.error(`Unknown error: ${message}`);
    return {
      ok: false,
      error: { code: 'UNKNOWN', message },
    };
  }
}
