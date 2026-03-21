# Requirements Document

## Introduction
わんコメのコメント翻訳連携で使用する、Trans-through互換の軽量翻訳サーバー。従来のDeepLやMicrosoft Translatorの代わりにLLM API（OpenAI, Anthropic, Google等）を翻訳エンジンとして使用し、配信コメントの文脈に即した高品質な翻訳を実現する。Trans-throughと同一のHTTP APIインターフェースを維持することで、わんコメ側の設定変更を最小限に抑える。

## Requirements

### Requirement 1: Trans-through互換APIエンドポイント
**Objective:** 配信者として、わんコメの既存のTrans-through連携設定をそのまま使いたい。設定変更なしで翻訳サーバーを切り替えられるようにするため。

#### Acceptance Criteria
1. The 翻訳サーバー shall `POST /` エンドポイントでリクエストを受け付け、JSON形式 `{"lang": "<言語コード>", "text": "<翻訳対象テキスト>"}` をパースする
2. When 翻訳が成功した場合, the 翻訳サーバー shall `{"lang": "<翻訳先言語コード>", "text": "<翻訳結果>", "status": "success"}` を返却する
3. If 翻訳が失敗した場合, the 翻訳サーバー shall `{"lang": "<元の言語コード>", "text": "<元のテキスト>", "status": "failure"}` を返却する
4. The 翻訳サーバー shall デフォルトで `http://localhost:8080/` でリッスンする
5. The 翻訳サーバー shall ポート番号を設定ファイルまたは環境変数で変更可能にする

### Requirement 2: LLM API翻訳エンジン
**Objective:** 配信者として、LLMの文脈理解力を活かした翻訳を使いたい。スラングや略語が多い配信コメントでも自然な翻訳を得るため。

#### Acceptance Criteria
1. The 翻訳サーバー shall 少なくともOpenAI・Anthropic・Google Geminiの3プロバイダーをサポートする
2. The 翻訳サーバー shall 設定ファイルで使用するプロバイダー・モデル名・APIキーを指定可能にする
3. The 翻訳サーバー shall 翻訳用のシステムプロンプトをデフォルトで内蔵し、設定ファイルでカスタマイズ可能にする
4. When リクエストの `lang` フィールドに翻訳先言語が指定された場合, the 翻訳サーバー shall その言語への翻訳をLLMに指示する
5. The 翻訳サーバー shall LLMのレスポンスから翻訳テキストのみを抽出し、余計な説明や装飾を含めずに返却する

### Requirement 3: 言語検出と翻訳方向
**Objective:** 配信者として、多言語の視聴者コメントを自動で日本語に翻訳したい。手動で言語設定を切り替える手間を省くため。

#### Acceptance Criteria
1. The 翻訳サーバー shall リクエストの `text` がすでに翻訳先言語と同一言語の場合、翻訳をスキップしてそのまま返却する
2. The 翻訳サーバー shall ソース言語の自動検出をLLMに委任する（明示的な言語検出ライブラリは不要）

### Requirement 4: パフォーマンスと軽量性
**Objective:** 配信者として、翻訳の遅延を最小限に抑えたい。配信中のコメント表示がスムーズに行われるようにするため。

#### Acceptance Criteria
1. The 翻訳サーバー shall 起動時のメモリ使用量を100MB以下に抑える
2. The 翻訳サーバー shall 同時に複数の翻訳リクエストを並行処理できる
3. While LLM APIの応答を待機中, the 翻訳サーバー shall 他のリクエストをブロックしない

### Requirement 5: エラーハンドリングと耐障害性
**Objective:** 配信者として、LLM APIに一時的な障害が起きてもサーバーが落ちないようにしたい。配信中にサーバー再起動が不要であるため。

#### Acceptance Criteria
1. If LLM APIがタイムアウトした場合, the 翻訳サーバー shall `status: "failure"` レスポンスを返却し、サーバーは稼働を継続する
2. If LLM APIが4xx/5xxエラーを返した場合, the 翻訳サーバー shall エラー内容をログに記録し、`status: "failure"` レスポンスを返却する
3. If リクエストのJSONが不正な場合, the 翻訳サーバー shall HTTP 400ステータスとともに `status: "failure"` レスポンスを返却する
4. The 翻訳サーバー shall LLM APIリクエストのタイムアウト時間を設定可能にする（デフォルト30秒）

### Requirement 6: 設定管理
**Objective:** 配信者として、設定ファイルで翻訳サーバーの動作を簡単にカスタマイズしたい。コードを変更せずに運用できるようにするため。

#### Acceptance Criteria
1. The 翻訳サーバー shall 設定ファイル（YAML or JSON）から以下を読み込む: ポート番号、LLMプロバイダー、モデル名、APIキー、タイムアウト、システムプロンプト
2. The 翻訳サーバー shall 環境変数によるAPIキー指定をサポートする（設定ファイルにAPIキーを直書きしなくてよいように）
3. When 設定ファイルが存在しない場合, the 翻訳サーバー shall デフォルト設定で起動し、APIキーのみ環境変数から必須とする

### Requirement 7: ログと運用監視
**Objective:** 配信者として、翻訳の動作状況を確認したい。問題が発生した際に原因を特定できるようにするため。

#### Acceptance Criteria
1. The 翻訳サーバー shall 起動時にリッスンポートとLLMプロバイダー名をログ出力する
2. The 翻訳サーバー shall 各翻訳リクエストの結果（成功/失敗）をログ出力する
3. The 翻訳サーバー shall ログレベル（debug/info/warn/error）を設定可能にする
