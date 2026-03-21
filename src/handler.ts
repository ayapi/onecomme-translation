import { Hono } from 'hono';
import type { TranslationService } from './translator.js';
import type { Logger } from './logger.js';

interface OneCommeParam {
  id: string;
  lang: string[];
  text: string;
}

interface OneCommeRequest {
  operation: string;
  params: OneCommeParam[];
}

function isOneCommeRequest(body: Record<string, unknown>): body is OneCommeRequest {
  return (
    body.operation === 'translates' &&
    Array.isArray(body.params)
  );
}

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

    const obj = body as Record<string, unknown>;

    // Trans-through format: { operation: "translates", params: [{ id, lang: [], text }] }
    if (isOneCommeRequest(obj)) {
      // Process each param (typically one at a time from OneComme)
      for (const param of obj.params) {
        const targetLangs = param.lang ?? [];
        const text = param.text ?? '';

        if (!targetLangs.length || !text) {
          logger.warn(`Skipping param ${param.id}: missing lang or text`);
          return c.json({
            operation: 'translates',
            status: 'failure',
            id: param.id,
            message: 'Missing lang or text',
          });
        }

        // Translate into each target language
        const result: { lang: string; text: string }[] = [];
        let detectLanguage = '';

        for (const lang of targetLangs) {
          const start = Date.now();
          const translationResult = await translationService.translate(text, lang);
          const elapsed = Date.now() - start;

          if (translationResult.ok) {
            const direction = translationResult.value.skipped ? `${lang} (skipped)` : `-> ${lang}`;
            logger.info(`Translation success: ${param.id} ${direction} [${elapsed}ms]`);
            if (!detectLanguage) {
              detectLanguage = translationResult.value.targetLang;
            }
            result.push({
              lang,
              text: translationResult.value.translatedText,
            });
          } else {
            logger.error(`Translation failure: ${param.id} ${translationResult.error.code} - ${translationResult.error.message} [${elapsed}ms]`);
            return c.json({
              operation: 'translates',
              status: 'failure',
              id: param.id,
              message: translationResult.error.message,
            });
          }
        }

        return c.json({
          operation: 'translates',
          status: 'success',
          id: param.id,
          detect_language: detectLanguage,
          result,
        });
      }
    }

    // Simple format: { lang, text }
    const { lang, text } = obj;
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
