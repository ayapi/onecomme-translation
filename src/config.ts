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
Rules:
- Output ONLY the translated text, nothing else.
- Do not add explanations, notes, or quotation marks.
- If the text is already in the target language, output the original text as-is and prepend "[SAME_LANG]" before it.
- Preserve the original tone, including slang, abbreviations, and internet language.`;

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

  const provider = (process.env['LLM_PROVIDER'] ?? fileConfig.provider ?? 'openai') as AppConfig['provider'];

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
    logLevel: (process.env['LOG_LEVEL'] ?? fileConfig.logLevel ?? 'info') as LogLevel,
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
