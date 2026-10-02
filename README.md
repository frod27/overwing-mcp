<p align="center">
  <a href="https://overwing.ai">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/wordmark-dark.svg">
      <img src="assets/wordmark.svg" alt="Overwing" width="220">
    </picture>
  </a>
</p>

<p align="center"><strong>Guardrails for LLM output, as MCP tools.</strong><br>
Score any text for safety and quality. Get <code>pass</code> / <code>fail</code> / <code>review</code> verdicts with calibrated confidence, usually in under 500 ms.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/overwing-mcp"><img alt="npm" src="https://img.shields.io/npm/v/overwing-mcp?color=0B1220&label=overwing-mcp"></a>
  <a href="https://overwing.ai/docs"><img alt="API reference" src="https://img.shields.io/badge/API-reference-0B1220"></a>
  <a href="https://overwing.ai"><img alt="agents welcome" src="https://overwing.ai/badge.svg"></a>
  <a href="https://mcpmarket.com/server/overwing?utm_source=readme&utm_medium=badge"><img alt="Listed on MCP Market" src="https://mcpmarket.com/badge/server/overwing.svg?theme=dark"></a>
</p>

<p align="center"><a href="readme/README.zh-CN.md">简体中文</a> · <a href="readme/README.ja.md">日本語</a> · <a href="readme/README.ko.md">한국어</a></p>

---

**Overwing** is an API that checks what your model said before it ships. This package exposes it to any MCP-capable agent: Claude Desktop, Claude Code, Cursor, Windsurf, VS Code, OpenAI's Agents SDK, and anything else that speaks the [Model Context Protocol](https://modelcontextprotocol.io).

- **Real verdicts, not vibes.** Every rule returns a typed answer, a probability, and a confidence. `fail` means a rule matched; `review` means it was unsure; `pass` means neither.
- **Prebuilt `content-safety` and `outbound-message` rule sets**: toxicity, personal data, confidential leaks, self-harm, sexual content, severity. Or write your own rules in plain language.
- **Built for agents.** Sign up, pay, evaluate, rotate keys, and cancel, all as JSON. No CAPTCHA, no browser required. See [overwing.ai/llms.txt](https://overwing.ai/llms.txt).

Try it without installing anything: paste text into the console at [overwing.ai](https://overwing.ai).

## Hosted, no install

The same 34 tools are served at `https://overwing.ai/mcp` (Streamable HTTP). Point any client that takes a remote MCP URL at it:

```bash
claude mcp add --transport http overwing https://overwing.ai/mcp
```

No key is needed for `evaluate`, `atlas_lookup`, `atlas_summary`, `list_plans`, `create_account` and the three `beacon_` tools. For the rest, send `Authorization: Bearer ow_live_...` on the connection.

## Install

It works with no API key: `evaluate` and `atlas_lookup` each run 10 times a day free, and text sent without a key is not stored. For more, get a key at [overwing.ai/login](https://overwing.ai/login), or let your agent make its own account with the `create_account` tool. That account has no email: nothing is sent to anyone, and the key is returned once. The same call from a shell:

```bash
curl -X POST https://overwing.ai/api/v1/signup
```

Put the key in `OVERWING_API_KEY`. An account with no email starts at 50 evaluations a day; proving a domain (`prove_domain`, `verify_domain`) raises it to the normal free limits and makes a lost key recoverable.

**Claude Code**

```bash
claude mcp add overwing -e OVERWING_API_KEY=ow_live_... -- npx -y overwing-mcp
```

**Claude Desktop, Cursor, Windsurf, VS Code** (any JSON-configured client)

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

Set `OVERWING_BASE_URL` to point at a self-hosted deployment. Requires Node 20+.

For [Overwing Tower](https://overwing.ai/products/tower), set `OVERWING_AGENT_KEY=ow_agent_...` to operate as an existing agent. Without it, `tower_create_agent` mints a key with the organization key and keeps it in memory for the session.

`evaluate`, `atlas_lookup`, `atlas_summary` and `list_plans` work with no key at all.

The text can be in any language. It was tested on 2026-09-29 in Spanish, Portuguese, French, German, Japanese, Simplified Chinese, Korean, Arabic and Hindi: a small test, not a benchmark. Results come back in English.

## Tools

| Tool | What it does |
| --- | --- |
| `evaluate` | Score one text against a rule set. Returns the verdict, a `recommended_action` (block, redact, review, or allow), aggregate score, confidence, latency, and per-rule results with each rule's action. Takes an optional `context` object (recipient, channel, ownership) that context-aware rule sets such as `outbound-message` read, and `store: false` to run the check without keeping the text. |
| `evaluate_batch` | Score up to 50 texts in one call, with a summary and per-item verdicts and recommended actions. |
| `list_rule_sets` · `get_rule_set` · `create_rule_set` | Browse the prebuilt set or define your own rules: yes/no questions, classifications, or scored scales. |
| `get_evaluation` · `list_evaluations` | Read stored results, filter by verdict or rule set, page with a cursor. |
| `create_account` · `prove_domain` · `verify_domain` | An account for the agent itself, with no email: `create_account` returns a key and sends nothing to anyone. Proving a domain (a DNS TXT record or a file) takes the place of the email: it raises the limits, opens full Beacon reports, and makes a lost key recoverable. |
| `atlas_lookup` | Overwing Atlas: say what a User-Agent string claims to be and whether the claim can be trusted (Web Bot Auth, spoofable string, or unattributable). Works with no key, 10 a day; 100 a day with a free key. |
| `atlas_agents` · `atlas_summary` | Search the registry of AI crawlers, fetchers and browser agents; get traffic shares, sector field-scan headlines, and the agent-spending summary. |
| `atlas_register_agent` · `atlas_verify_registration` · `atlas_list_registrations` · `atlas_withdraw_registration` | Add an agent you operate to the Atlas registry, free, so a lookup of its User-Agent names you. Register it, publish the value you are given at the operator's domain (a DNS TXT record or a file), then verify. Needs `OVERWING_API_KEY`. |
| `beacon_start` · `beacon_report` · `beacon_sample` | Overwing Beacon: is a site reachable by agents? Checks robots.txt, llms.txt, the MCP server card, endpoint and Registry listing, the A2A agent card and OpenAPI, and how the home page reads to a model. A check is free: `beacon_start` returns an id and `beacon_report` runs the check and returns the report. With `OVERWING_API_KEY` it is the full report, saved to your dashboard; with no key it is the summary (the score, the three answers and the first fix). `beacon_sample` is a real report in full. |
| `tower_load_template` · `tower_create_agent` · `tower_list_agents` · `tower_revoke_agent` | Overwing Tower setup, with the organization key: load the starter order-entry workflow, then mint a scoped agent identity. The new agent key is used for the rest of the session. |
| `tower_capabilities` · `tower_decide` · `tower_submit_action` · `tower_get_action` · `tower_compensate` | Overwing Tower operations, with the agent key: see which operations you may call and their input schemas, ask how a request would be ruled, submit it (executed, pending human review, or rejected), poll it, undo it. |
| `tower_get_receipt` · `tower_verify_receipts` | Read a signed receipt, or recompute every hash and signature in the chain. |
| `get_usage` · `whoami` · `list_plans` | Today's quota, the org behind the key, and the public plan catalog. |

The `overwing://guide` resource returns the full plain-text API guide.

## Data handling and security

What this server does on your machine: it reads three environment variables (`OVERWING_API_KEY`, `OVERWING_AGENT_KEY`, `OVERWING_BASE_URL`) and makes HTTPS requests to the Overwing API. It reads no files, runs no commands, and talks to no other host. It has two runtime dependencies (`@modelcontextprotocol/sdk`, `zod`), and the whole server is one file: [src/index.ts](src/index.ts).

What happens to text you evaluate:

- It is sent to the Overwing API, and from there to TypeSafe, whose Jev model produces the verdict. It is not used to train models.
- **Without a key** the text is never stored.
- **With a key** the text, context and verdict are stored so you can read them back with `get_evaluation`, until you delete them. To change that:
  - pass `store: false` to `evaluate` or `evaluate_batch` to keep no text or context for that call;
  - set `store_inputs: false` on the organization (`PATCH /api/v1/org`, or the dashboard) to keep none at all;
  - set `retention_days` on the organization to delete evaluations after that many days.
- Traffic is encrypted in transit (TLS) and the database is encrypted at rest (AES-256).

Give your agent a restricted key. A key with scope `evaluate` can run checks and read rule sets, and cannot read stored evaluations, change rule sets, manage keys, webhooks or billing, or delete anything:

```bash
curl -X POST https://overwing.ai/api/v1/api-keys \
  -H "Authorization: Bearer ow_live_..." -H "Content-Type: application/json" \
  -d '{"name":"agent","scope":"evaluate"}'
```

Overwing is a young service and has not had an independent security audit. The full picture, including subprocessors and what we have not done, is at [overwing.ai/security](https://overwing.ai/security); the privacy policy is at [overwing.ai/privacy](https://overwing.ai/privacy). To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Example

Ask your agent:

> Check this reply before I send it: "Reach me at dana@example.com or 555-0142 to sort out the refund."

It calls `evaluate` and gets back:

```
Verdict: FAIL  score=0.82  confidence=0.97  251ms
  toxicity: pass (answer="safe", confidence=1)
  pii_detected: fail (answer=true, confidence=0.98)
  self_harm: pass (answer=false, confidence=1)
  sexual_content: pass (answer="none", confidence=1)
  severity: pass (answer=0.03, confidence=0.97)
```

## How verdicts work

Each rule has a fail condition, an optional review threshold, and a weight.

- **fail**: a rule's fail condition matched. Block it, redact it, or regenerate.
- **review**: nothing failed, but a rule's confidence was below its threshold. Route to a person or a slower model.
- **pass**: everything else.

Every rule also carries an **action** (`block`, `redact`, or `review`), and the response rolls them up into one `recommended_action`: `block` beats `redact` beats `review` beats `allow`. Branch on that field. Pass a `context` object (recipient, channel, `owns_contact_info`) with the `outbound-message` rule set and its rules read it, so a customer's own phone number in a reply to that customer is not flagged.

`aggregate_score` is 0 to 1 (pass = 1, review = 0.5, fail = 0 per rule, weighted). `confidence` is the minimum across rules.

## Pricing

Free: 250 evaluations a day. Paid plans from $29/month. Every plan includes every endpoint, custom rule sets, webhooks, and the dashboard. Full details at [overwing.ai/#pricing](https://overwing.ai/#pricing) or `GET https://overwing.ai/api/v1/plans`.

## Links

- Website and live demo: [overwing.ai](https://overwing.ai)
- API reference: [overwing.ai/docs](https://overwing.ai/docs)
- OpenAPI: [overwing.ai/api/v1/openapi.json](https://overwing.ai/api/v1/openapi.json)
- Guide for agents: [overwing.ai/llms.txt](https://overwing.ai/llms.txt)
- Support: support@overwing.ai

## Development

```bash
npm install
npm run build
OVERWING_API_KEY=ow_live_... node dist/index.js
```

MIT © Overwing. Verdicts are produced by TypeSafe's Jev System One model; Overwing is not affiliated with TypeSafe.
