# Implementation Plan

- [x] 1. プロジェクト初期化とビルド環境構築
- [x] 1.1 Node.jsプロジェクトを作成し、TypeScript・ESM環境をセットアップする
  - package.jsonを作成し、`type: "module"` を設定する
  - TypeScript設定ファイルで`strict: true`、ESMモジュール出力を設定する
  - 必要な依存パッケージをインストールする: hono, @hono/node-server, ai, @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google, js-yaml, dotenv
  - 開発用依存: typescript, tsup, @types/node
  - tsupでビルドスクリプトを設定し、単一ファイルにバンドルできるようにする
  - _Requirements: 4.1_

- [x] 2. ロガーと設定ローダーの実装
- [x] 2.1 (P) ログレベル付きのシンプルなロガーを実装する
  - debug/info/warn/errorの4段階のログレベルをサポートする
  - 設定されたログレベル以上のメッセージのみ出力する
  - タイムスタンプとログレベルを含むフォーマット（例: `[INFO] 2026-03-21T12:00:00Z - メッセージ`）で出力する
  - console.log/warn/errorベースで外部ライブラリを使用しない
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 2.2 (P) YAML設定ファイルと環境変数から設定を読み込むローダーを実装する
  - デフォルト値を定義する: ポート8080、プロバイダーopenai、タイムアウト30秒、ログレベルinfo
  - プロバイダー別のデフォルトモデルを設定する: OpenAI→gpt-4.1-nano、Anthropic→claude-haiku-4-5、Google→gemini-2.5-flash-lite
  - config.yamlが存在する場合はYAMLを読み込みデフォルト値を上書きする
  - 環境変数（PORT, LLM_PROVIDER, LLM_MODEL, LLM_API_KEY, LLM_TIMEOUT, LOG_LEVEL）で最終上書きする
  - APIキーはLLM_API_KEYの他に、プロバイダー別のOPENAI_API_KEY/ANTHROPIC_API_KEY/GOOGLE_API_KEYも代替としてサポートする
  - .envファイルをdotenvで読み込む
  - 設定ファイルが存在しない場合でもデフォルト値で正常起動する
  - デフォルトのシステムプロンプトを内蔵し、設定ファイルでカスタマイズ可能にする
  - _Requirements: 1.4, 1.5, 2.2, 2.3, 5.4, 6.1, 6.2, 6.3, 7.3_

- [x] 3. 翻訳サービスの実装
- [x] 3.1 Vercel AI SDKを使った翻訳サービスのコアロジックを実装する
  - 設定のプロバイダー名に応じてOpenAI/Anthropic/Googleのモデルインスタンスを生成する
  - generateText()にシステムプロンプトと翻訳対象テキストを渡して翻訳を実行する
  - システムプロンプトで翻訳テキストのみを出力するよう指示し、temperature: 0で決定的な結果を得る
  - 言語コードを自然言語名に変換するマッピングを用意する（ja→Japanese、ja_JP→Japanese等。両形式をサポート）
  - マッピングにない言語コードはそのままLLMに渡す
  - _Requirements: 2.1, 2.4, 2.5, 3.2_
  - _Contracts: TranslationService Service Interface_

- [x] 3.2 同一言語スキップと翻訳結果の返却を実装する
  - テキストが既に翻訳先言語と同一言語かどうかの判定をLLMに委任する（システムプロンプトで指示）
  - 翻訳結果をTranslateResult型（ok/error判別共用体）で返却する
  - LLMレスポンスから翻訳テキストのみを抽出し、余計な説明や装飾を除去する
  - _Requirements: 2.5, 3.1, 3.2_

- [x] 3.3 LLM APIのタイムアウトとエラーハンドリングを実装する
  - AbortControllerを使用して設定されたタイムアウト時間でリクエストを中断する
  - タイムアウト時はTIMEOUTエラーコード付きのTranslationErrorを返却する
  - LLM APIの4xx/5xxエラー時はAPI_ERRORコードとエラー内容を返却する
  - 予期しない例外はUNKNOWNコードで捕捉し、例外をスローしない
  - 全てのエラーケースでログに詳細を記録する
  - _Requirements: 5.1, 5.2_

- [ ] 4. HTTPハンドラーとサーバーエントリーポイントの実装
- [ ] 4.1 HonoでTrans-through互換のPOSTエンドポイントを実装する
  - POST / でJSONリクエスト `{lang, text}` を受け取りバリデーションする
  - 不正なJSONやフィールド不足の場合はHTTP 400と `{status: "failure"}` を返却する
  - バリデーション通過後、翻訳サービスのtranslateメソッドを呼び出す
  - 翻訳成功時は `{lang: 翻訳先言語, text: 翻訳結果, status: "success"}` を返却する
  - 翻訳失敗時は `{lang: 元の言語コード, text: 元のテキスト, status: "failure"}` を返却する
  - 各リクエストの結果（成功/失敗、翻訳方向、所要時間）をログ出力する
  - _Requirements: 1.1, 1.2, 1.3, 5.3, 7.2_
  - _Contracts: HttpHandler API Contract_

- [ ] 4.2 サーバーのエントリーポイントを実装し、全コンポーネントを結合する
  - dotenvで.envを読み込み、設定ローダーで設定を構築する
  - ロガーをログレベル設定で初期化する
  - 翻訳サービスを設定（プロバイダー、モデル、APIキー、タイムアウト、システムプロンプト）で初期化する
  - HTTPハンドラーに翻訳サービスとロガーを注入する
  - @hono/node-serverのserveで指定ポートにサーバーを起動する
  - 起動時にリッスンポート、プロバイダー名、モデル名をINFOログ出力する
  - _Requirements: 1.4, 4.2, 4.3, 7.1_

- [ ] 5. サンプル設定ファイルとビルド検証
- [ ] 5.1 サンプル設定ファイルと起動手順を用意する
  - config.example.yamlを作成し、全設定項目をコメント付きで記述する
  - .env.exampleを作成し、APIキーの設定例を記述する
  - package.jsonにstart/dev/buildスクリプトを追加する
  - ビルドを実行し、単一ファイルバンドルが生成されることを確認する
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 6. テスト
- [ ] 6.1 設定ローダーのユニットテストを実装する
  - デフォルト値が正しく設定されることを検証する
  - YAMLファイルからの読み込みでデフォルト値が上書きされることを検証する
  - 環境変数がYAML設定より優先されることを検証する
  - 設定ファイルが存在しない場合にデフォルト値で起動することを検証する
  - プロバイダー別のAPIキー環境変数がフォールバックとして機能することを検証する
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 6.2 (P) Trans-through互換APIの統合テストを実装する
  - 正常な翻訳リクエストに対して `{lang, text, status: "success"}` が返ることを検証する（モックLLM使用）
  - 翻訳失敗時に `{lang, text, status: "failure"}` が返ることを検証する
  - 不正なJSONリクエストに対してHTTP 400が返ることを検証する
  - フィールド不足のリクエストに対してHTTP 400が返ることを検証する
  - _Requirements: 1.1, 1.2, 1.3, 5.3_

- [ ] 6.3 (P) 翻訳サービスのユニットテストを実装する
  - LLMレスポンスから翻訳テキストのみが抽出されることを検証する
  - タイムアウト時にTIMEOUTエラーが返却されることを検証する
  - APIエラー時にAPI_ERRORエラーが返却されることを検証する
  - 言語コードマッピングが正しく動作することを検証する（ja, ja_JP両形式）
  - _Requirements: 2.5, 3.2, 5.1, 5.2_
