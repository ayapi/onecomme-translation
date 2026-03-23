import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import 'dotenv/config';
import type { LogLevel } from './logger.js';

export interface AppConfig {
  port: number;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  apiKey: string;
  timeout: number;
  systemPrompt: string;
  logLevel: LogLevel;
}

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4.1-nano',
  anthropic: 'claude-haiku-4-5',
  google: 'gemini-2.5-flash-lite',
};

const DEFAULT_SYSTEM_PROMPT = `You are a translation engine. Translate the given text to the specified target language.

OUTPUT FORMAT (strict):
- Output ONLY the translated text. Nothing else.
- NEVER add explanations, notes, commentary, or parenthetical remarks.
- NEVER include the original text, romanization, or transliteration in your output.
- If the text is already in the target language, prepend "[SAME_LANG]" before the original text.

TRANSLATION RULES:
- TRANSLATE THE MEANING, not the sound. Katakana phonetic transcription (e.g., writing Spanish words in katakana) is NOT translation. Always convey what the words MEAN in the target language.
- Proper nouns (personal names, place names, brand names) may be transliterated into the target script, but all other words must be translated by meaning.
- These are live stream chat messages. Interpret them in a casual, conversational context.
- Preserve the original tone, including slang, abbreviations, and internet language.
- When a word has multiple meanings, choose the interpretation that fits a friendly chat context (e.g., compliments, jokes, reactions).
- Prioritize conveying the speaker's intent over word-for-word literal translation.
- For figurative or idiomatic expressions, translate the intended meaning.
- If unsure about the source language, still translate to the best of your ability. Do not explain your uncertainty.
- If the text is completely untranslatable (unknown script, random characters, not a real language), output ONLY "[UNTRANSLATABLE]".`;

interface YamlConfig {
  port?: number;
  provider?: string;
  model?: string;
  timeout?: number;
  systemPrompt?: string;
  logLevel?: string;
}

export function loadConfig(configPath?: string): AppConfig {
  const filePath = configPath ?? resolve(process.cwd(), 'config.yaml');

  let fileConfig: YamlConfig = {};
  if (existsSync(filePath)) {
    const raw = readFileSync(filePath, 'utf-8');
    fileConfig = (yaml.load(raw) as YamlConfig) ?? {};
  }

  const VALID_PROVIDERS = ['openai', 'anthropic', 'google'] as const;
  const rawProvider = process.env['LLM_PROVIDER'] ?? fileConfig.provider ?? 'openai';
  if (!VALID_PROVIDERS.includes(rawProvider as typeof VALID_PROVIDERS[number])) {
    throw new Error(`Invalid provider: "${rawProvider}". Must be one of: ${VALID_PROVIDERS.join(', ')}`);
  }
  const provider = rawProvider as AppConfig['provider'];

  const apiKey =
    process.env['LLM_API_KEY'] ??
    getProviderApiKey(provider) ??
    '';

  const model =
    process.env['LLM_MODEL'] ??
    fileConfig.model ??
    DEFAULT_MODELS[provider] ??
    DEFAULT_MODELS.openai;

  return {
    port: toNumber(process.env['PORT']) ?? fileConfig.port ?? 8080,
    provider,
    model,
    apiKey,
    timeout: toNumber(process.env['LLM_TIMEOUT']) ?? fileConfig.timeout ?? 30000,
    systemPrompt: fileConfig.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    logLevel: validateLogLevel(process.env['LOG_LEVEL'] ?? fileConfig.logLevel ?? 'info'),
  };
}

function getProviderApiKey(provider: string): string | undefined {
  const envMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_API_KEY',
  };
  const envName = envMap[provider];
  return envName ? process.env[envName] : undefined;
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

const VALID_LOG_LEVELS: readonly string[] = ['debug', 'info', 'warn', 'error'];

function validateLogLevel(value: string): LogLevel {
  if (!VALID_LOG_LEVELS.includes(value)) {
    throw new Error(`Invalid log level: "${value}". Must be one of: ${VALID_LOG_LEVELS.join(', ')}`);
  }
  return value as LogLevel;
}
