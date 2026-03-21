# Research & Design Decisions

## Summary
- **Feature**: `llm-translate-server`
- **Discovery Scope**: New Feature（グリーンフィールド）
- **Key Findings**:
  - Vercel AI SDK（`ai` v6）が3プロバイダー統一インターフェースを提供、独自抽象レイヤー不要
  - Honoが単一エンドポイントサーバーに最適（ゼロ依存、最速、TypeScript-first）
  - 最安モデル: gpt-4.1-nano ($0.10/M), gemini-2.5-flash-lite ($0.10/M), claude-haiku-4-5 ($1.00/M)

## Research Log

### LLM APIプロバイダーとモデル選定
- **Context**: 要件2（LLM API翻訳エンジン）で3プロバイダーサポートが必要
- **Sources Consulted**: OpenAI公式料金ページ、Anthropic公式ドキュメント、Google AI公式ドキュメント
- **Findings**:
  - OpenAI: `gpt-4.1-nano` が最安（$0.10/$0.40/M tokens）、翻訳タスクに十分な品質
  - Anthropic: `claude-haiku-4-5` が最安（$1.00/$5.00/M tokens）、Claude 3 Haikuは2026年4月に廃止予定
  - Google: `@google/generative-ai` は非推奨・アーカイブ済み、`@google/genai` v1.46.0が後継
  - Google: `gemini-2.5-flash-lite` が最安（$0.10/$0.40/M tokens）
- **Implications**: デフォルトモデルは各プロバイダーの最安モデルを設定。Google SDKは新パッケージ `@google/genai` を使用必須

### 統一LLM SDK
- **Context**: 3プロバイダーを統一的に扱えるSDKがあるか調査
- **Sources Consulted**: npm registry、Vercel AI SDK公式ドキュメント
- **Findings**:
  - Vercel AI SDK (`ai` v6.0.134) が `generateText()` で統一インターフェースを提供
  - プロバイダーパッケージ: `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`
  - 30以上のプロバイダーをサポート、将来の拡張も容易
  - `temperature`, `maxTokens`, `system`, `prompt` が全プロバイダー共通
- **Implications**: 独自のプロバイダー抽象レイヤーを作る必要がなく、設定でモデル文字列を変えるだけでプロバイダー切り替え可能

### HTTPフレームワーク選定
- **Context**: 要件4（軽量性）で低メモリ・高速起動が必要
- **Sources Consulted**: Hono公式ドキュメント、Fastify公式ドキュメント、ベンチマーク比較記事
- **Findings**:
  - Hono: ゼロ依存（コアパッケージ）、136,112 req/sec（Deno）、TypeScript-first
  - Fastify: `pino`ロガー内蔵、プラグインアーキテクチャ、Honoより重い
  - Express: 最も遅い、最も依存多い、単一エンドポイントには過剰
- **Implications**: Honoが最適。Node.jsでは `@hono/node-server` アダプターを使用

### 設定管理パターン
- **Context**: 要件6（設定管理）でファイル+環境変数のサポートが必要
- **Sources Consulted**: Node.js設定管理ベストプラクティス記事
- **Findings**:
  - YAML: 人間が読みやすい、コメント可能、`js-yaml`で解析
  - 設定優先順位: デフォルト値 < 設定ファイル < 環境変数
  - APIキーは環境変数からの読み込みが標準的なセキュリティプラクティス
- **Implications**: YAML形式の設定ファイル + dotenvによる.envサポート

### Trans-through言語コード形式
- **Context**: 要件1（Trans-through互換）で言語コードの正確な形式が必要
- **Sources Consulted**: Trans-through公式サイト（machanbazaar.com）、わんコメフォーラム
- **Findings**:
  - 公開されたAPIドキュメントは存在しない
  - リクエスト例から `en_US`, `ja_JP` 形式（ロケールスタイル）と `en`, `ja` 形式（ISO 639-1）の両方が使われる可能性
  - わんコメからは翻訳先言語コードが `lang` フィールドで送られる
- **Implications**: 両形式をサポートする言語コードマッピングが必要

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| シンプルレイヤード | HTTP → Service → Provider の3層 | 理解しやすい、実装が速い、テストしやすい | 拡張性は限定的 | 単一エンドポイントサーバーに最適 |
| ヘキサゴナル | Ports & Adaptersで外部依存を抽象化 | テスト容易、プロバイダー追加が容易 | このスケールでは過剰設計 | Vercel AI SDKが既にアダプター層を提供 |

**選定: シンプルレイヤード** — Vercel AI SDKがプロバイダー抽象を担うため、追加のアダプター層は不要。

## Design Decisions

### Decision: Vercel AI SDK採用
- **Context**: 3つのLLMプロバイダーを統一的に扱う必要がある
- **Alternatives Considered**:
  1. 各プロバイダーSDKを直接使用し、独自の抽象レイヤーを構築
  2. Vercel AI SDKで統一インターフェースを利用
- **Selected Approach**: Vercel AI SDK
- **Rationale**: 既にプロバイダー間の差異を吸収済み。`generateText()` 1つで全プロバイダー対応。
- **Trade-offs**: Vercel AI SDKへの依存が増えるが、独自抽象レイヤーの保守コストが不要
- **Follow-up**: SDK v6のAPI安定性を確認

### Decision: Hono + @hono/node-server
- **Context**: 軽量で高速なHTTPサーバーが必要（要件4）
- **Alternatives Considered**:
  1. Fastify — 高機能だが重い
  2. Express — エコシステムは大きいが低速
  3. Hono — ゼロ依存、最速
- **Selected Approach**: Hono
- **Rationale**: 単一POSTエンドポイントに最適。ゼロ依存でメモリ100MB以下の要件を容易に達成。
- **Trade-offs**: Fastifyほどの機能は無いが、このユースケースでは不要

### Decision: YAML設定ファイル + dotenv
- **Context**: 配信者が簡単に設定を編集できる必要がある（要件6）
- **Alternatives Considered**:
  1. JSON — コメント不可、配信者に不親切
  2. TOML — Node.jsでは一般的でない
  3. YAML — コメント可能、可読性が高い
- **Selected Approach**: YAML（`js-yaml`）+ `dotenv`
- **Rationale**: YAMLはコメントで設定項目を説明でき、技術者でない配信者にも扱いやすい
- **Trade-offs**: `js-yaml`依存が増えるが、軽量なパッケージ

## Risks & Mitigations
- LLM APIのレイテンシが翻訳表示を遅延させる — maxTokensを低く設定し、高速モデルをデフォルトに
- LLM APIの料金が想定以上に膨らむ — 最安モデルをデフォルトにし、ドキュメントでコスト目安を記載
- Trans-through互換性の不完全 — 言語コード形式を両方サポートし、実機テストで検証

## References
- [OpenAI Models Pricing](https://platform.openai.com/docs/models) — モデル一覧と料金
- [Anthropic Claude Models](https://docs.anthropic.com/en/docs/about-claude/models) — Claudeモデル仕様
- [Google Gemini Models](https://ai.google.dev/gemini-api/docs/models) — Geminiモデル一覧
- [Vercel AI SDK](https://sdk.vercel.ai/) — 統一LLMインターフェース
- [Hono](https://hono.dev/) — 軽量HTTPフレームワーク
- [@google/genai](https://www.npmjs.com/package/@google/genai) — Google AI新SDK（旧@google/generative-aiの後継）
- [Trans-through](https://machanbazaar.com/trans-throght/) — Trans-through公式サイト
