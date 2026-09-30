<p align="center">
  <a href="https://overwing.ai">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../assets/wordmark-dark.svg">
      <img src="../assets/wordmark.svg" alt="Overwing" width="220">
    </picture>
  </a>
</p>

<p align="center"><strong>LLM 出力のためのガードレール（Guardrails）を、MCP ツールとして。</strong><br>
任意のテキストを安全性と品質の観点でスコアリングし、<code>pass</code>（合格）/ <code>fail</code>（不合格）/ <code>review</code>（要確認）の判定を、較正済みの信頼度とともに、通常 500 ms 未満で返します。</p>

<p align="center">
  <a href="https://www.npmjs.com/package/overwing-mcp"><img alt="npm" src="https://img.shields.io/npm/v/overwing-mcp?color=0B1220&label=overwing-mcp"></a>
  <a href="https://overwing.ai/docs"><img alt="API reference" src="https://img.shields.io/badge/API-reference-0B1220"></a>
  <a href="https://overwing.ai"><img alt="agents welcome" src="https://overwing.ai/badge.svg"></a>
  <a href="https://mcpmarket.com/server/overwing?utm_source=readme&utm_medium=badge"><img alt="Listed on MCP Market" src="https://mcpmarket.com/badge/server/overwing.svg?theme=dark"></a>
</p>

<p align="center"><a href="../README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ko.md">한국어</a></p>

---

**Overwing** は、モデルの出力を外に出す前にチェックする API です。このパッケージは、その API を MCP 対応のあらゆるエージェントから使えるようにします。Claude Desktop、Claude Code、Cursor、Windsurf、VS Code、OpenAI の Agents SDK のほか、[Model Context Protocol](https://modelcontextprotocol.io) に対応したクライアントであれば利用できます。

- **雰囲気ではなく、明確な判定を。** 各ルールは、型の決まった回答・確率・信頼度を返します。`fail` はルールに該当したこと、`review` はモデルの確信が足りなかったこと、`pass` はそのどちらでもないことを意味します。
- **組み込みの `content-safety` と `outbound-message` ルールセット**：有害表現（toxicity）、個人情報、機密情報の漏えい、自傷、性的コンテンツ、深刻度。自然言語で独自のルールを書くこともできます。
- **エージェントのための設計。** サインアップ、支払い、評価、キーのローテーション、解約まで、すべて JSON で完結します。CAPTCHA もブラウザも不要です。[overwing.ai/llms.txt](https://overwing.ai/llms.txt) を参照してください。

インストールせずに試すこともできます。[overwing.ai](https://overwing.ai) のコンソールにテキストを貼り付けてください。

## ホスト版（インストール不要）

同じ 27 個のツールを `https://overwing.ai/mcp`（Streamable HTTP）でも提供しています。リモート MCP の URL を指定できるクライアントなら、そのまま接続できます。

```bash
claude mcp add --transport http overwing https://overwing.ai/mcp
```

`evaluate`、`atlas_lookup`、`atlas_summary`、`list_plans` はキーなしで利用できます。それ以外は接続時に `Authorization: Bearer ow_live_...` を送ってください。

## インストール

API キーなしでも動作します。`evaluate` と `atlas_lookup` はそれぞれ 1 日 10 回まで無料で実行でき、キーなしで送信したテキストは保存されません。それ以上使う場合は、[overwing.ai/login](https://overwing.ai/login) でキーを取得するか、エージェント自身にサインアップさせてください。

```bash
curl -X POST https://overwing.ai/api/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"at-least-12-chars"}'
```

**Claude Code**

```bash
claude mcp add overwing -e OVERWING_API_KEY=ow_live_... -- npx -y overwing-mcp
```

**Claude Desktop、Cursor、Windsurf、VS Code**（JSON で設定するクライアント全般）

```json
{
  "mcpServers": {
    "overwing": {
      "command": "npx",
      "args": ["-y", "overwing-mcp"],
      "env": { "OVERWING_API_KEY": "ow_live_..." }
    }
  }
}
```

セルフホスト環境を参照する場合は `OVERWING_BASE_URL` を設定します。Node 20 以上が必要です。

[Overwing Tower](https://overwing.ai/products/tower) では、`OVERWING_AGENT_KEY=ow_agent_...` を設定すると既存のエージェントとして操作できます。設定していない場合は、`tower_create_agent` が組織キーを使ってエージェントキーを発行し、セッションの間だけメモリ上に保持します。

`evaluate`、`atlas_lookup`、`atlas_summary`、`list_plans` はキーなしで利用できます。

入力テキストは何語でもかまいません。2026-09-29 にスペイン語、ポルトガル語、フランス語、ドイツ語、日本語、簡体字中国語、韓国語、アラビア語、ヒンディー語でテストしました。小規模なテストであり、ベンチマークではありません。結果は英語で返ります。

## ツール

| ツール | 内容 |
| --- | --- |
| `evaluate` | 1 件のテキストをルールセットに照らしてスコアリングします。判定（verdict）、`recommended_action`（推奨アクション：block 遮断、redact マスキング、review 要確認、allow 許可）、総合スコア、信頼度、レイテンシ、および各ルールの結果とそのルールのアクションを返します。任意で `context` オブジェクト（宛先、チャネル、情報の所有者）を渡すことができ、`outbound-message` のようなコンテキスト対応のルールセットがこれを参照します。 |
| `evaluate_batch` | 1 回の呼び出しで最大 50 件のテキストをスコアリングし、サマリーと各項目の判定・推奨アクションを返します。 |
| `list_rule_sets` · `get_rule_set` · `create_rule_set` | 組み込みのルールセットを参照するか、独自のルールを定義します。はい／いいえの質問、分類、段階スケールでの評価が使えます。 |
| `get_evaluation` · `list_evaluations` | 保存済みの結果を取得します。判定やルールセットで絞り込み、カーソルでページ送りできます。 |
| `atlas_lookup` | Overwing Atlas：User-Agent 文字列が何を名乗っているか、その主張を信頼できるか（Web Bot Auth、偽装可能な文字列、または帰属不明）を返します。キーなしで 1 日 10 回、無料キーでは 1 日 100 回まで利用できます。 |
| `atlas_agents` · `atlas_summary` | AI クローラー、フェッチャー、ブラウザエージェントのレジストリを検索します。トラフィックシェア、業種別フィールドスキャンの要点、エージェントの支出に関するサマリーも取得できます。 |
| `tower_load_template` · `tower_create_agent` · `tower_list_agents` · `tower_revoke_agent` | Overwing Tower のセットアップ（組織キーを使用）：スターター用の受注入力ワークフローを読み込み、スコープを限定したエージェント ID を発行します。発行されたエージェントキーは、以降のセッションで使われます。 |
| `tower_capabilities` · `tower_decide` · `tower_submit_action` · `tower_get_action` · `tower_compensate` | Overwing Tower の操作（エージェントキーを使用）：呼び出せるオペレーションとその入力スキーマを確認し、リクエストがどう裁定されるかを問い合わせ、送信し（実行済み、人によるレビュー待ち、または却下）、状態をポーリングし、取り消します。 |
| `tower_get_receipt` · `tower_verify_receipts` | 署名付きレシートを取得するか、チェーン内のすべてのハッシュと署名を再計算します。 |
| `get_usage` · `whoami` · `list_plans` | 本日のクォータ、キーに紐づく組織、公開されているプラン一覧。 |

`overwing://guide` リソースは、プレーンテキストの API ガイド全文を返します。

## データの取り扱いとセキュリティ

このサーバーがお使いのマシン上で行うこと：3 つの環境変数（`OVERWING_API_KEY`、`OVERWING_AGENT_KEY`、`OVERWING_BASE_URL`）を読み取り、Overwing API に HTTPS リクエストを送ります。ファイルは読まず、コマンドも実行せず、ほかのホストとは通信しません。実行時の依存パッケージは 2 つ（`@modelcontextprotocol/sdk`、`zod`）で、サーバー全体は 1 ファイルです：[src/index.ts](../src/index.ts)。

評価するテキストの扱い：

- テキストは Overwing API に送られ、そこから TypeSafe に送られます。TypeSafe の Jev モデルが判定を出します。モデルの学習には使われません。
- **キーなし**の場合、テキストは保存されません。
- **キーあり**の場合、テキスト、context、判定は保存され、削除するまで `get_evaluation` で読み出せます。これを変えるには：
  - `evaluate` または `evaluate_batch` に `store: false` を渡すと、その呼び出しではテキストも context も保存されません。
  - 組織に `store_inputs: false` を設定すると（`PATCH /api/v1/org` またはダッシュボード）、いっさい保存されません。
  - 組織に `retention_days` を設定すると、その日数を過ぎた評価は削除されます。
- 通信は TLS で暗号化され、データベースは保存時に AES-256 で暗号化されます。

エージェントには権限を絞ったキーを渡してください。スコープが `evaluate` のキーは、チェックの実行とルールセットの読み取りだけができます。保存済みの評価の読み取り、ルールセットの変更、キー・Webhook・課金の管理、削除はできません。

```bash
curl -X POST https://overwing.ai/api/v1/api-keys \
  -H "Authorization: Bearer ow_live_..." -H "Content-Type: application/json" \
  -d '{"name":"agent","scope":"evaluate"}'
```

Overwing は新しいサービスで、第三者によるセキュリティ監査はまだ受けていません。サブプロセッサーや未対応の事項を含む全体像は [overwing.ai/security](https://overwing.ai/security)（英語）に、プライバシーポリシーは [overwing.ai/privacy](https://overwing.ai/privacy)（英語）にあります。脆弱性の報告方法は [SECURITY.md](../SECURITY.md) を参照してください。

## 使用例

エージェントにこう頼みます。

> 送信する前にこの返信をチェックして："Reach me at dana@example.com or 555-0142 to sort out the refund."

エージェントは `evaluate` を呼び出し、次の結果を受け取ります。

```
Verdict: FAIL  score=0.82  confidence=0.97  251ms
  toxicity: pass (answer="safe", confidence=1)
  pii_detected: fail (answer=true, confidence=0.98)
  self_harm: pass (answer=false, confidence=1)
  sexual_content: pass (answer="none", confidence=1)
  severity: pass (answer=0.03, confidence=0.97)
```

## 判定の仕組み

各ルールには、fail 条件、任意の review しきい値、重みがあります。

- **fail**：いずれかのルールの fail 条件に該当しました。遮断するか、マスキングするか、生成し直してください。
- **review**：fail はありませんが、あるルールの信頼度がしきい値を下回りました。人か、より低速なモデルに回してください。
- **pass**：上記以外のすべて。

各ルールには **action**（`block`、`redact`、`review` のいずれか）も設定されており、レスポンスではそれらが 1 つの `recommended_action` に集約されます。優先順位は `block`、`redact`、`review`、`allow` の順です。このフィールドで処理を分岐してください。`outbound-message` ルールセットに `context` オブジェクト（宛先、チャネル、`owns_contact_info`）を渡すとルールがそれを参照するため、顧客本人への返信に含まれるその顧客自身の電話番号は検出対象になりません。

`aggregate_score` は 0 から 1 の値です（ルールごとに pass = 1、review = 0.5、fail = 0 とし、重み付けして算出）。`confidence` は全ルール中の最小値です。

## 料金

無料：1 日 250 回の評価。有料プランもあります。どのプランでも、すべてのエンドポイント、カスタムルールセット、Webhook、ダッシュボードを利用できます。詳細は [overwing.ai/#pricing](https://overwing.ai/#pricing) または `GET https://overwing.ai/api/v1/plans` を参照してください。

## リンク

- ウェブサイトとライブデモ：[overwing.ai](https://overwing.ai)
- API リファレンス：[overwing.ai/docs](https://overwing.ai/docs)
- OpenAPI：[overwing.ai/api/v1/openapi.json](https://overwing.ai/api/v1/openapi.json)
- エージェント向けガイド：[overwing.ai/llms.txt](https://overwing.ai/llms.txt)
- サポート：support@overwing.ai

## 開発

```bash
npm install
npm run build
OVERWING_API_KEY=ow_live_... node dist/index.js
```

MIT © Overwing。判定は TypeSafe の Jev System One モデルによって生成されます。Overwing は TypeSafe と提携関係にありません。
