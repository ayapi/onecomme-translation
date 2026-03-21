import { serve } from '@hono/node-server';
import { loadConfig } from './config.js';
import { Logger } from './logger.js';
import { TranslationService } from './translator.js';
import { createApp } from './handler.js';

const config = loadConfig();
const logger = new Logger(config.logLevel);
const translationService = new TranslationService(config, logger);
const app = createApp(translationService, logger);

logger.info(`Starting server on port ${config.port}`);
logger.info(`Provider: ${config.provider}, Model: ${config.model}`);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  logger.info(`Server listening on http://localhost:${info.port}`);
});
