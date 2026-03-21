# onecomme-translation

わんコメのコメント翻訳連携で使用する、[Trans-through](https://machanbazaar.com/trans-throght/) 互換の軽量翻訳サーバー。

DeepL や Microsoft Translator の代わりに LLM API（OpenAI / Anthropic / Google Gemini）を翻訳エンジンとして使用し、配信コメントの文脈に即した高品質な翻訳を実現します。

## 特徴

- **Trans-through 互換** — わんコメ側の設定変更なしでそのまま使える
- **3 プロバイダー対応** — OpenAI・Anthropic・Google Gemini を切り替え可能
- **軽量** — Hono ベースで起動時メモリ 100MB 以下
- **簡単設定** — YAML ファイル + 環境変数で設定完結

## クイックスタート

```bash
# インストール
npm install

# APIキーを設定
cp .env.example .env
# .env を編集して LLM_API_KEY を設定

# 開発モードで起動
npm run dev

# または、ビルドして起動
npm run build
npm start
```

サーバーが `http://localhost:8080` で起動します。わんコメの翻訳連携先をこの URL に設定してください。

## 設定

### APIキー（必須）

`.env` ファイルまたは環境変数で設定します。

```bash
# 共通キー（どのプロバイダーでも使用可能）
LLM_API_KEY=your-api-key-here

# または、プロバイダー別のキー
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AI...
```

### 設定ファイル（オプション）

`config.yaml` を作成するとサーバーの動作をカスタマイズできます。

```bash
cp config.example.yaml config.yaml
```

```yaml
# サーバーポート番号
port: 8080

# LLMプロバイダー: openai, anthropic, google
provider: openai

# 使用するモデル名
model: gpt-4.1-nano

# APIリクエストのタイムアウト(ミリ秒)
timeout: 30000

# ログレベル: debug, info, warn, error
logLevel: info

# システムプロンプト（翻訳の挙動をカスタマイズ）
# systemPrompt: |
#   You are a translation engine. ...
```

### 環境変数一覧

環境変数は設定ファイルより優先されます。

| 環境変数 | 説明 | デフォルト |
|---|---|---|
| `LLM_API_KEY` | APIキー（共通） | — |
| `OPENAI_API_KEY` | OpenAI APIキー（代替） | — |
| `ANTHROPIC_API_KEY` | Anthropic APIキー（代替） | — |
| `GOOGLE_API_KEY` | Google APIキー（代替） | — |
| `PORT` | サーバーポート番号 | `8080` |
| `LLM_PROVIDER` | プロバイダー | `openai` |
| `LLM_MODEL` | モデル名 | プロバイダー依存 |
| `LLM_TIMEOUT` | タイムアウト(ms) | `30000` |
| `LOG_LEVEL` | ログレベル | `info` |

### デフォルトモデル

| プロバイダー | デフォルトモデル | 参考コスト (入力/出力) |
|---|---|---|
| OpenAI | `gpt-4.1-nano` | $0.10 / $0.40 per 1M tokens |
| Anthropic | `claude-haiku-4-5` | $1.00 / $5.00 per 1M tokens |
| Google | `gemini-2.5-flash-lite` | $0.10 / $0.40 per 1M tokens |

## API

Trans-through と同一の HTTP API を提供します。

### `POST /`

**リクエスト:**

```json
{
  "lang": "ja",
  "text": "Hello, world!"
}
```

**レスポンス（成功）:**

```json
{
  "lang": "ja",
  "text": "こんにちは、世界！",
  "status": "success"
}
```

**レスポンス（失敗）:**

```json
{
  "lang": "ja",
  "text": "Hello, world!",
  "status": "failure"
}
```

## 開発

```bash
# テスト実行
npm test

# 開発サーバー起動（ホットリロード）
npm run dev

# ビルド
npm run build
```

## ライセンス

MIT
