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
pnpm install

# APIキーを設定
cp .env.example .env
# .env を編集して LLM_API_KEY を設定

# 開発モードで起動
pnpm dev

# または、ビルドして起動
pnpm build
pnpm start
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

各プロバイダーで最もコスパの良いモデルをデフォルトに設定しています。

| プロバイダー | デフォルトモデル | 入力 $/1M tokens | 出力 $/1M tokens |
|---|---|---|---|
| OpenAI | `gpt-4.1-nano` | $0.10 | $0.40 |
| Anthropic | `claude-haiku-4-5` | $1.00 | $5.00 |
| Google | `gemini-2.5-flash-lite` | $0.10 | $0.40 |

### 翻訳向けモデル一覧

配信コメント翻訳に適したモデルをコスト順に掲載しています（2026年3月時点）。

#### OpenAI

| モデル | 入力 $/1M | 出力 $/1M | 速度 | 備考 |
|---|---|---|---|---|
| **`gpt-4.1-nano`** | $0.10 | $0.40 | 最速 | **デフォルト** 最安・高速。翻訳に十分な品質 |
| `gpt-4o-mini` | $0.15 | $0.60 | 非常に速い | 実績ある品質 |
| `gpt-5.4-nano` | $0.20 | $1.25 | 非常に速い | 最新世代。nano より高品質 |
| `gpt-4.1-mini` | $0.40 | $1.60 | 速い | 品質とコストのバランス型 |
| `gpt-5-mini` | $0.25 | $2.00 | 速い | 品質重視なら選択肢 |

#### Anthropic

| モデル | 入力 $/1M | 出力 $/1M | 速度 | 備考 |
|---|---|---|---|---|
| **`claude-haiku-4-5`** | $1.00 | $5.00 | 最速 | **デフォルト** 多言語翻訳の品質が高い |
| `claude-sonnet-4-6` | $3.00 | $15.00 | 速い | 高品質だがコスト高 |

#### Google Gemini

| モデル | 入力 $/1M | 出力 $/1M | 速度 | 備考 |
|---|---|---|---|---|
| **`gemini-2.5-flash-lite`** | $0.10 | $0.40 | 非常に速い | **デフォルト** 最安。無料枠あり |
| `gemini-2.5-flash` | $0.30 | $2.50 | 速い | より高品質な Flash。無料枠あり |
| `gemini-3.1-flash-lite-preview` | $0.25 | $1.50 | 非常に速い | 最新世代の Lite モデル |

#### コスト目安

忙しい配信（1時間あたり約10,000コメント翻訳）の場合:

| モデル | 1時間あたりコスト |
|---|---|
| gpt-4.1-nano / gemini-2.5-flash-lite | 約 $0.09 |
| claude-haiku-4-5 | 約 $1.00 |

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
pnpm test

# 開発サーバー起動（ホットリロード）
pnpm dev

# ビルド
pnpm build
```

## ライセンス

MIT
