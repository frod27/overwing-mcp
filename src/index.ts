#!/usr/bin/env node
/**
 * Overwing MCP server. Exposes the Overwing guardrails API as tools so any
 * MCP-capable agent can score text, manage rule sets, and read usage.
 *
 *   OVERWING_API_KEY   required   ow_live_...
 *   OVERWING_BASE_URL  optional   defaults to https://overwing.ai
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = (process.env.OVERWING_BASE_URL ?? "https://overwing.ai").replace(/\/$/, "");
const API_KEY = process.env.OVERWING_API_KEY;

type ApiResult = { ok: true; status: number; body: unknown } | { ok: false; status: number; error: string };

async function api(method: string, path: string, body?: unknown, auth = true): Promise<ApiResult> {
  if (auth && !API_KEY) {
    return { ok: false, status: 0, error: "OVERWING_API_KEY is not set. Get a key at " + BASE_URL + "/login or POST " + BASE_URL + "/api/v1/signup." };
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (auth && API_KEY) headers.Authorization = `Bearer ${API_KEY}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (err) {
    return { ok: false, status: 0, error: `Network error reaching ${BASE_URL}: ${err instanceof Error ? err.message : String(err)}` };
  }
  const text = await res.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* keep text */ }
  if (!res.ok) {
    const msg = typeof parsed === "object" && parsed !== null && "error" in parsed ? String((parsed as { error: unknown }).error) : text.slice(0, 300);
    const retry = res.headers.get("retry-after");
    return { ok: false, status: res.status, error: `${res.status}: ${msg}${retry ? ` (retry after ${retry}s)` : ""}` };
  }
  return { ok: true, status: res.status, body: parsed };
}

function reply(result: ApiResult, summarize?: (body: unknown) => string): { content: { type: "text"; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean } {
  if (!result.ok) {
    return { content: [{ type: "text", text: result.error }], isError: true };
  }
  const text = summarize ? summarize(result.body) : JSON.stringify(result.body, null, 2);
  const structured = typeof result.body === "object" && result.body !== null && !Array.isArray(result.body) ? (result.body as Record<string, unknown>) : { result: result.body };
  return { content: [{ type: "text", text }], structuredContent: structured };
}

const server = new McpServer({ name: "overwing", version: "0.4.0" });

const ruleSchema = z.object({
  name: z.string().max(100),
  description: z.string().optional(),
  question_type: z.enum(["choice", "score", "noul"]),
  question_config: z.record(z.string(), z.unknown()).describe("choice: {options[], instructions}; score: {levels[], instructions}; noul: {question}"),
  fail_condition: z.record(z.string(), z.unknown()).describe("choice: {failOn: [options]}; noul: {failOn: boolean}; score: {failAbove: levelIndex}"),
  review_condition: z.object({ confidenceBelow: z.number().gt(0).lte(1) }).optional(),
  weight: z.number().gt(0).lte(100).optional(),
  action: z.enum(["block", "redact", "review"]).optional().describe("What a caller should do when this rule fails: block (default), redact, or review"),
});

const contextSchema = z.record(z.string(), z.unknown()).optional().describe("Facts the rules may reference: recipient, channel, whether you own the data, sender, purpose. Sent to the model alongside the text (max 8 KB). Use the 'outbound-message' rule set to have it honoured.");

server.registerTool(
  "evaluate",
  {
    title: "Evaluate text",
    description:
      "Score any text (typically an LLM's output) against an Overwing rule set. Returns an aggregate verdict of pass, fail, or review, a recommended_action (block, redact, review, or allow), and per-rule answers with probability, confidence, and the rule's action. Act on recommended_action: block means do not send, redact means remove the flagged content and resend, review means ask a human or a slower model, allow means proceed. Prebuilt sets: 'content-safety' (toxicity, PII, self-harm, sexual content, severity) and 'outbound-message', which also takes a context object (recipient, channel, owns_contact_info) so PII that the recipient already owns is not flagged.",
    inputSchema: {
      input: z.string().min(1).max(100_000).describe("The text to evaluate"),
      rule_set: z.string().default("content-safety").describe("Rule set slug"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Opaque data stored with the evaluation and echoed in webhooks (max 8 KB)"),
      context: contextSchema,
    },
  },
  async ({ input, rule_set, metadata, context }) =>
    reply(await api("POST", "/api/v1/evaluate", { input, rule_set, metadata, context }), (b) => {
      const r = b as { id: string; verdict: string; recommended_action?: string; aggregate_score: number; confidence: number; latency_ms: number; results: { rule: string; answer: unknown; confidence: number; verdict: string; action?: string }[] };
      const rules = r.results.map((x) => `  ${x.rule}: ${x.verdict}${x.verdict === "fail" && x.action ? ` -> ${x.action}` : ""} (answer=${JSON.stringify(x.answer)}, confidence=${x.confidence})`).join("\n");
      return `Verdict: ${r.verdict.toUpperCase()}  recommended_action=${r.recommended_action ?? "n/a"}  score=${r.aggregate_score}  confidence=${r.confidence}  ${r.latency_ms}ms  id=${r.id}\n${rules}`;
    }),
);

server.registerTool(
  "evaluate_batch",
  {
    title: "Evaluate many texts",
    description: "Score up to 50 texts against one rule set in a single call. Each item counts as one evaluation. Returns a summary plus per-item verdicts; items can fail independently.",
    inputSchema: {
      items: z.array(z.object({ id: z.string().max(128).optional(), input: z.string().min(1).max(100_000), metadata: z.record(z.string(), z.unknown()).optional(), context: z.record(z.string(), z.unknown()).optional().describe("Per-item context; overrides the batch-level context") })).min(1).max(50),
      rule_set: z.string().default("content-safety"),
      context: contextSchema,
    },
  },
  async ({ items, rule_set, context }) =>
    reply(await api("POST", "/api/v1/evaluate/batch", { rule_set, items, context }), (b) => {
      const r = b as { summary: { total: number; pass: number; fail: number; review: number; errors: number }; results: { id: string | null; index: number; evaluation: { verdict: string; recommended_action?: string; id: string } | null; error: string | null }[] };
      const lines = r.results.map((x) => `  ${x.id ?? `#${x.index}`}: ${x.evaluation ? `${x.evaluation.verdict}${x.evaluation.recommended_action ? ` -> ${x.evaluation.recommended_action}` : ""} (${x.evaluation.id})` : `ERROR ${x.error}`}`).join("\n");
      return `Batch of ${r.summary.total}: ${r.summary.pass} pass, ${r.summary.fail} fail, ${r.summary.review} review, ${r.summary.errors} errors\n${lines}`;
    }),
);

server.registerTool(
  "list_rule_sets",
  { title: "List rule sets", description: "List the prebuilt and custom rule sets available to this organization.", inputSchema: { include_inactive: z.boolean().optional() } },
  async ({ include_inactive }) => reply(await api("GET", `/api/v1/rule-sets${include_inactive ? "?include_inactive=true" : ""}`)),
);

server.registerTool(
  "get_rule_set",
  { title: "Get rule set", description: "Fetch a rule set with its full rule definitions. Use 'content-safety' as a worked example when writing your own.", inputSchema: { slug: z.string() } },
  async ({ slug }) => reply(await api("GET", `/api/v1/rule-sets/${encodeURIComponent(slug)}`)),
);

server.registerTool(
  "create_rule_set",
  {
    title: "Create rule set",
    description: "Create a custom rule set with 1 to 25 rules. Each rule is a choice (pick one option), score (position on an ordered scale), or noul (yes/no) question with a fail condition, optional review threshold, weight, and action (block, redact, or review) that callers should take when it fails. Rule instructions may reference `context.*` fields that callers pass with each evaluation.",
    inputSchema: {
      name: z.string().max(100),
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
      description: z.string().optional(),
      rules: z.array(ruleSchema).min(1).max(25),
    },
  },
  async (args) => reply(await api("POST", "/api/v1/rule-sets", args)),
);

server.registerTool(
  "get_evaluation",
  { title: "Get evaluation", description: "Fetch a stored evaluation by id, including the original input and per-rule results.", inputSchema: { id: z.string() } },
  async ({ id }) => reply(await api("GET", `/api/v1/evaluations/${encodeURIComponent(id)}`)),
);

server.registerTool(
  "list_evaluations",
  {
    title: "List evaluations",
    description: "List recent evaluations, newest first, with optional verdict and rule set filters. Use next_cursor to page.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).optional(),
      verdict: z.enum(["pass", "fail", "review"]).optional(),
      rule_set: z.string().optional(),
      cursor: z.string().optional(),
    },
  },
  async ({ limit, verdict, rule_set, cursor }) => {
    const q = new URLSearchParams();
    if (limit) q.set("limit", String(limit));
    if (verdict) q.set("verdict", verdict);
    if (rule_set) q.set("rule_set", rule_set);
    if (cursor) q.set("cursor", cursor);
    const qs = q.toString();
    return reply(await api("GET", `/api/v1/evaluations${qs ? `?${qs}` : ""}`));
  },
);

server.registerTool(
  "get_usage",
  { title: "Get usage", description: "Daily usage, remaining quota for today, and plan limits.", inputSchema: { days: z.number().int().min(1).max(90).optional() } },
  async ({ days }) => reply(await api("GET", `/api/v1/usage${days ? `?days=${days}` : ""}`)),
);

server.registerTool(
  "whoami",
  { title: "Who am I", description: "Identify the organization and plan behind the configured API key, and whether billing is set up.", inputSchema: {} },
  async () => {
    const me = await api("GET", "/api/v1/me");
    if (!me.ok) return reply(me);
    const billing = await api("GET", "/api/v1/billing");
    return reply({ ok: true, status: 200, body: { ...(me.body as object), billing: billing.ok ? billing.body : null } });
  },
);

server.registerTool(
  "list_plans",
  { title: "List plans", description: "Public plan catalog: prices, daily limits, and per-minute burst limits. No API key needed.", inputSchema: {} },
  async () => reply(await api("GET", "/api/v1/plans", undefined, false)),
);

server.registerResource(
  "guide",
  "overwing://guide",
  { title: "Overwing API guide", description: "The plain-text API guide (llms.txt): auth, verdict semantics, limits, billing, webhooks.", mimeType: "text/plain" },
  async (uri) => {
    const res = await fetch(`${BASE_URL}/llms.txt`);
    return { contents: [{ uri: uri.href, mimeType: "text/plain", text: await res.text() }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
