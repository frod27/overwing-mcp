<p align="center">
  <a href="https://overwing.ai">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/wordmark-dark.svg">
      <img src="assets/wordmark.svg" alt="Overwing" width="220">
    </picture>
  </a>
</p>

<p align="center"><strong>Guardrails for LLM output, as MCP tools.</strong><br>
Score any text for safety, quality and compliance. Get <code>pass</code> / <code>fail</code> / <code>review</code> verdicts with calibrated confidence in under 500 ms.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/overwing-mcp"><img alt="npm" src="https://img.shields.io/npm/v/overwing-mcp?color=0B1220&label=overwing-mcp"></a>
  <a href="https://overwing.ai/docs"><img alt="API reference" src="https://img.shields.io/badge/API-reference-0B1220"></a>
  <a href="https://overwing.ai"><img alt="agents welcome" src="https://overwing.ai/badge.svg"></a>
</p>

---

**Overwing** is an API that checks what your model said before it ships. This package exposes it to any MCP-capable agent: Claude Desktop, Claude Code, Cursor, Windsurf, VS Code, OpenAI's Agents SDK, and anything else that speaks the [Model Context Protocol](https://modelcontextprotocol.io).

- **Real verdicts, not vibes.** Every rule returns a typed answer, a probability, and a confidence. `fail` means a rule matched; `review` means it was unsure; `pass` means neither.
- **Prebuilt `content-safety` rule set**: toxicity, personal data, self-harm, sexual content, severity. Or write your own rules in plain language.
- **Built for agents.** Sign up, pay, evaluate, rotate keys, and cancel, all as JSON. No CAPTCHA, no browser required. See [overwing.ai/llms.txt](https://overwing.ai/llms.txt).

Try it without installing anything: paste text into the console at [overwing.ai](https://overwing.ai).

## Install

You need an API key. Get one at [overwing.ai/login](https://overwing.ai/login), or let your agent sign itself up:

```bash
curl -X POST https://overwing.ai/api/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"at-least-12-chars"}'
```

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

## Tools

| Tool | What it does |
| --- | --- |
| `evaluate` | Score one text against a rule set. Returns the verdict, a `recommended_action` (block, redact, review, or allow), aggregate score, confidence, latency, and per-rule results with each rule's action. Takes an optional `context` object (recipient, channel, ownership) that context-aware rule sets such as `outbound-message` read. |
| `evaluate_batch` | Score up to 50 texts in one call, with a summary and per-item verdicts and recommended actions. |
| `list_rule_sets` · `get_rule_set` · `create_rule_set` | Browse the prebuilt set or define your own rules: yes/no questions, classifications, or scored scales. |
| `get_evaluation` · `list_evaluations` | Read stored results, filter by verdict or rule set, page with a cursor. |
| `get_usage` · `whoami` · `list_plans` | Today's quota, the org behind the key, and the public plan catalog. |

The `overwing://guide` resource returns the full plain-text API guide.

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
