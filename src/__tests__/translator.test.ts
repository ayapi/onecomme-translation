import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranslationService, getLangName } from '../translator.js';
import type { AppConfig } from '../config.js';
import { Logger } from '../logger.js';

// Mock the AI SDK - APICallError class defined inline to avoid hoisting issues
vi.mock('ai', () => {
  class APICallError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.name = 'AI_APICallError';
      this.statusCode = statusCode;
    }
  }
  return {
    generateText: vi.fn(),
    APICallError,
  };
});

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn(() => 'mock-model')),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => vi.fn(() => 'mock-model')),
}));

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => 'mock-model')),
}));

import { generateText, APICallError } from 'ai';

const mockGenerateText = vi.mocked(generateText);
const MockAPICallError = APICallError as unknown as new (message: string, statusCode: number) => Error;

function createTestConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    port: 8080,
    provider: 'openai',
    model: 'gpt-4.1-nano',
    apiKey: 'test-key',
    timeout: 30000,
    systemPrompt: 'test prompt',
    logLevel: 'error',
    ...overrides,
  };
}

describe('getLangName', () => {
  it('言語コードを自然言語名に変換する', () => {
    expect(getLangName('ja')).toBe('Japanese');
    expect(getLangName('en')).toBe('English');
    expect(getLangName('ko')).toBe('Korean');
  });

  it('ロケール形式の言語コードも変換する', () => {
    expect(getLangName('ja_JP')).toBe('Japanese');
    expect(getLangName('en_US')).toBe('English');
    expect(getLangName('zh_CN')).toBe('Simplified Chinese');
    expect(getLangName('zh_TW')).toBe('Traditional Chinese');
  });

  it('マッピングにない言語コードはそのまま返す', () => {
    expect(getLangName('xx')).toBe('xx');
    expect(getLangName('unknown')).toBe('unknown');
  });
});

describe('TranslationService', () => {
  let service: TranslationService;
  let logger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new Logger('error');
    service = new TranslationService(createTestConfig(), logger);
  });

  it('LLMレスポンスから翻訳テキストのみが抽出される', async () => {
    mockGenerateText.mockResolvedValue({
      text: '  Hello World  ',
    } as any);

    const result = await service.translate('こんにちは世界', 'en');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.translatedText).toBe('Hello World');
      expect(result.value.targetLang).toBe('en');
      expect(result.value.skipped).toBe(false);
    }
  });

  it('同一言語の場合はスキップされる', async () => {
    mockGenerateText.mockResolvedValue({
      text: '[SAME_LANG]こんにちは',
    } as any);

    const result = await service.translate('こんにちは', 'ja');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.translatedText).toBe('こんにちは');
      expect(result.value.skipped).toBe(true);
    }
  });

  it('[SAME_LANG]が末尾や括弧内にあってもスキップされる', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'こんにちは [SAME_LANG]',
    } as any);

    const result = await service.translate('こんにちは', 'ja');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.translatedText).toBe('こんにちは');
      expect(result.value.skipped).toBe(true);
    }
  });

  it('翻訳不能なテキストは空文字列が返される', async () => {
    mockGenerateText.mockResolvedValue({
      text: '[UNTRANSLATABLE]',
    } as any);

    const result = await service.translate('Ayapi tui-p-an.', 'ja');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.translatedText).toBe('');
      expect(result.value.skipped).toBe(true);
    }
  });

  it('タイムアウト時にTIMEOUTエラーが返却される', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockGenerateText.mockRejectedValue(abortError);

    const result = await service.translate('test', 'ja');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('TIMEOUT');
    }
  });

  it('APICallError時にAPI_ERRORエラーが返却される', async () => {
    mockGenerateText.mockRejectedValue(new MockAPICallError('Unauthorized', 401));

    const result = await service.translate('test', 'ja');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('API_ERROR');
      expect(result.error.message).toContain('Unauthorized');
    }
  });

  it('通常のErrorはAPIエラーではなくUNKNOWNになる', async () => {
    mockGenerateText.mockRejectedValue(new Error('401 Unauthorized'));

    const result = await service.translate('test', 'ja');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNKNOWN');
    }
  });

  it('非Errorオブジェクトの例外はUNKNOWNエラーとなる', async () => {
    mockGenerateText.mockRejectedValue('string error');

    const result = await service.translate('test', 'ja');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNKNOWN');
    }
  });

  it('内部エラー（非APIエラー）はUNKNOWNに分類される', async () => {
    mockGenerateText.mockRejectedValue(new Error('Cannot read properties of undefined'));

    const result = await service.translate('test', 'ja');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNKNOWN');
    }
  });
});
