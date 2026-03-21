import { Hono } from 'hono';
import type { TranslationService } from './translator.js';
import type { Logger } from './logger.js';

export function createApp(translationService: TranslationService, logger: Logger): Hono {
  const app = new Hono();

  app.post('/', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      logger.warn('Invalid JSON in request body');
      return c.json({ lang: '', text: '', status: 'failure' }, 400);
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      logger.warn('Request body must be a JSON object');
      return c.json({ lang: '', text: '', status: 'failure' }, 400);
    }

    const { lang, text } = body as Record<string, unknown>;
    if (typeof lang !== 'string' || typeof text !== 'string' || !lang || !text) {
      logger.warn('Missing or invalid required fields: lang and text must be non-empty strings');
      return c.json({ lang: '', text: '', status: 'failure' }, 400);
    }

    const start = Date.now();
    const result = await translationService.translate(text, lang);
    const elapsed = Date.now() - start;

    if (result.ok) {
      const direction = result.value.skipped ? `${lang} (skipped)` : `-> ${lang}`;
      logger.info(`Translation success: ${direction} [${elapsed}ms]`);
      return c.json({
        lang: result.value.targetLang,
        text: result.value.translatedText,
        status: 'success',
      });
    }

    logger.error(`Translation failure: ${result.error.code} - ${result.error.message} [${elapsed}ms]`);
    return c.json({
      lang: lang,
      text: text,
      status: 'failure',
    });
  });

  return app;
}
