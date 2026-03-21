import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from '../config.js';

const TEST_CONFIG_PATH = resolve(process.cwd(), 'test-config.yaml');

function cleanupTestConfig() {
  if (existsSync(TEST_CONFIG_PATH)) {
    unlinkSync(TEST_CONFIG_PATH);
  }
}

describe('ConfigLoader', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    cleanupTestConfig();
    // Clear relevant env vars
    delete process.env['PORT'];
    delete process.env['LLM_PROVIDER'];
    delete process.env['LLM_MODEL'];
    delete process.env['LLM_API_KEY'];
    delete process.env['LLM_TIMEOUT'];
    delete process.env['LOG_LEVEL'];
    delete process.env['OPENAI_API_KEY'];
    delete process.env['ANTHROPIC_API_KEY'];
    delete process.env['GOOGLE_API_KEY'];
  });

  afterEach(() => {
    cleanupTestConfig();
    // Restore env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  it('デフォルト値が正しく設定される', () => {
    const config = loadConfig(TEST_CONFIG_PATH);
    expect(config.port).toBe(8080);
    expect(config.provider).toBe('openai');
    expect(config.model).toBe('gpt-4.1-nano');
    expect(config.timeout).toBe(30000);
    expect(config.logLevel).toBe('info');
    expect(config.apiKey).toBe('');
  });

  it('YAMLファイルからの読み込みでデフォルト値が上書きされる', () => {
    writeFileSync(TEST_CONFIG_PATH, `
port: 9090
provider: anthropic
model: claude-sonnet-4-5-20250514
timeout: 60000
logLevel: debug
`);
    const config = loadConfig(TEST_CONFIG_PATH);
    expect(config.port).toBe(9090);
    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-sonnet-4-5-20250514');
    expect(config.timeout).toBe(60000);
    expect(config.logLevel).toBe('debug');
  });

  it('環境変数がYAML設定より優先される', () => {
    writeFileSync(TEST_CONFIG_PATH, `
port: 9090
provider: anthropic
model: claude-sonnet-4-5-20250514
`);
    process.env['PORT'] = '3000';
    process.env['LLM_PROVIDER'] = 'google';
    process.env['LLM_MODEL'] = 'gemini-2.5-pro';

    const config = loadConfig(TEST_CONFIG_PATH);
    expect(config.port).toBe(3000);
    expect(config.provider).toBe('google');
    expect(config.model).toBe('gemini-2.5-pro');
  });

  it('設定ファイルが存在しない場合にデフォルト値で起動する', () => {
    const config = loadConfig('/nonexistent/path/config.yaml');
    expect(config.port).toBe(8080);
    expect(config.provider).toBe('openai');
    expect(config.model).toBe('gpt-4.1-nano');
  });

  it('プロバイダー別のAPIキー環境変数がフォールバックとして機能する', () => {
    process.env['LLM_PROVIDER'] = 'anthropic';
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test-key';

    const config = loadConfig(TEST_CONFIG_PATH);
    expect(config.apiKey).toBe('sk-ant-test-key');
  });

  it('LLM_API_KEYがプロバイダー別キーより優先される', () => {
    process.env['LLM_PROVIDER'] = 'openai';
    process.env['LLM_API_KEY'] = 'common-key';
    process.env['OPENAI_API_KEY'] = 'openai-specific-key';

    const config = loadConfig(TEST_CONFIG_PATH);
    expect(config.apiKey).toBe('common-key');
  });

  it('プロバイダー別のデフォルトモデルが設定される', () => {
    process.env['LLM_PROVIDER'] = 'google';
    const config = loadConfig(TEST_CONFIG_PATH);
    expect(config.model).toBe('gemini-2.5-flash-lite');
  });

  it('システムプロンプトがYAMLからカスタマイズ可能', () => {
    writeFileSync(TEST_CONFIG_PATH, `
systemPrompt: "Custom prompt"
`);
    const config = loadConfig(TEST_CONFIG_PATH);
    expect(config.systemPrompt).toBe('Custom prompt');
  });

  it('不正なプロバイダー名でエラーをスローする', () => {
    process.env['LLM_PROVIDER'] = 'invalid';
    expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow('Invalid provider: "invalid"');
  });

  it('不正なログレベルでエラーをスローする', () => {
    process.env['LOG_LEVEL'] = 'verbose';
    expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow('Invalid log level: "verbose"');
  });
});
