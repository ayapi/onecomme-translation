import { Hono } from 'hono';
import type { TranslationService } from './translator.js';
import type { Logger } from './logger.js';

interface TranslateRequest {
  lang: string;
  text: string;
}

export function createApp(translationService: TranslationService, logger: Logger): Hono {
  const app = new Hono();

  app.post('/', async (c) => {
    let body: TranslateRequest;
    try {
      body = await c.req.json<TranslateRequest>();
    } catch {
      logger.warn('Invalid JSON in request body');
      return c.json({ lang: '', text: '', status: 'failure' }, 400);
    }

    if (typeof body.lang !== 'string' || typeof body.text !== 'string' || !body.lang || !body.text) {
      logger.warn('Missing or invalid required fields: lang and text must be non-empty strings');
      return c.json({ lang: '', text: '', status: 'failure' }, 400);
    }

    const start = Date.now();
    const result = await translationService.translate(body.text, body.lang);
    const elapsed = Date.now() - start;

    if (result.ok) {
      const direction = result.value.skipped ? `${body.lang} (skipped)` : `-> ${body.lang}`;
      logger.info(`Translation success: ${direction} [${elapsed}ms]`);
      return c.json({
        lang: result.value.targetLang,
        text: result.value.translatedText,
        status: 'success',
      });
    }

    logger.error(`Translation failure: ${result.error.code} - ${result.error.message} [${elapsed}ms]`);
    return c.json({
      lang: body.lang,
      text: body.text,
      status: 'failure',
    });
  });

  return app;
}
