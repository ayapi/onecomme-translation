import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../handler.js';
import { Logger } from '../logger.js';
import type { TranslationService, TranslateResult } from '../translator.js';

function createMockTranslationService(result: TranslateResult): TranslationService {
  return {
    translate: vi.fn().mockResolvedValue(result),
  } as unknown as TranslationService;
}

describe('HTTP Handler', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('error');
  });

  it('正常な翻訳リクエストに対して成功レスポンスを返す', async () => {
    const service = createMockTranslationService({
      ok: true,
      value: { translatedText: 'Hello', targetLang: 'en', skipped: false },
    });
    const app = createApp(service, logger);

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: 'en', text: 'こんにちは' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ lang: 'en', text: 'Hello', status: 'success' });
  });

  it('翻訳失敗時にfailureレスポンスを返す', async () => {
    const service = createMockTranslationService({
      ok: false,
      error: { code: 'API_ERROR', message: 'test error' },
    });
    const app = createApp(service, logger);

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: 'en', text: 'こんにちは' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ lang: 'en', text: 'こんにちは', status: 'failure' });
  });

  it('不正なJSONリクエストに対してHTTP 400を返す', async () => {
    const service = createMockTranslationService({
      ok: true,
      value: { translatedText: '', targetLang: '', skipped: false },
    });
    const app = createApp(service, logger);

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe('failure');
  });

  it('フィールド不足のリクエストに対してHTTP 400を返す', async () => {
    const service = createMockTranslationService({
      ok: true,
      value: { translatedText: '', targetLang: '', skipped: false },
    });
    const app = createApp(service, logger);

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: 'en' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe('failure');
  });

  it('非文字列型のフィールドに対してHTTP 400を返す', async () => {
    const service = createMockTranslationService({
      ok: true,
      value: { translatedText: '', targetLang: '', skipped: false },
    });
    const app = createApp(service, logger);

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: 123, text: ['array'] }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe('failure');
  });

  it('nullのJSONボディに対してHTTP 400を返す', async () => {
    const service = createMockTranslationService({
      ok: true,
      value: { translatedText: '', targetLang: '', skipped: false },
    });
    const app = createApp(service, logger);

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null',
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe('failure');
  });

  it('配列のJSONボディに対してHTTP 400を返す', async () => {
    const service = createMockTranslationService({
      ok: true,
      value: { translatedText: '', targetLang: '', skipped: false },
    });
    const app = createApp(service, logger);

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '[1, 2, 3]',
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe('failure');
  });

  it('スキップ時も成功レスポンスを返す', async () => {
    const service = createMockTranslationService({
      ok: true,
      value: { translatedText: 'こんにちは', targetLang: 'ja', skipped: true },
    });
    const app = createApp(service, logger);

    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: 'ja', text: 'こんにちは' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ lang: 'ja', text: 'こんにちは', status: 'success' });
  });
});
