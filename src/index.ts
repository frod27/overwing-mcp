#!/usr/bin/env node
/**
 * Overwing MCP server. Exposes the Overwing guardrails API as tools so any
 * MCP-capable agent can score text, manage rule sets, and read usage.
 *
 *   OVERWING_API_KEY    optional organization key, ow_live_...  (higher limits, rule sets, Tower setup)
 *                       Without it, evaluate and atlas_lookup use the free allowance: 10 a day each.
 *   OVERWING_AGENT_KEY  optional agent key, ow_agent_... (Tower operations). Without it,
 *                       tower_create_agent mints one and this process keeps it in memory.
 *   OVERWING_BASE_URL   optional, defaults to https://overwing.ai
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = (process.env.OVERWING_BASE_URL ?? "https://overwing.ai").replace(/\/$/, "");
const API_KEY = process.env.OVERWING_API_KEY;
/** Tower agent key: from the environment, or minted by tower_create_agent and held for this process only. */
let agentKey: string | undefined = process.env.OVERWING_AGENT_KEY;

type ApiResult = { ok: true; status: number; body: unknown } | { ok: false; status: number; error: string; body?: unknown };

/**
 * Which credential a call carries.
 *   true / "org"  the organization key, required
 *   "optional"    the organization key when set, otherwise none (keyless allowances)
 *   "agent"       the Tower agent key, required
 *   false         none
 */
type Auth = boolean | "org" | "optional" | "agent";

function describeError(parsed: unknown, fallback: string): string {
  if (typeof parsed !== "object" || parsed === null || !("error" in parsed)) return fallback;
  const e = (parsed as { error: unknown }).error;
  if (typeof e === "object" && e !== null) {
    const t = e as { code?: unknown; field?: unknown; message?: unknown; suggested_fix?: unknown };
    return `${String(t.code ?? "error")}${t.field ? ` (${String(t.field)})` : ""}: ${String(t.message ?? "")}${t.suggested_fix ? ` Fix: ${String(t.suggested_fix)}` : ""}`;
  }
  return String(e);
}

async function api(method: string, path: string, body?: unknown, auth: Auth = true): Promise<ApiResult> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (auth === "agent") {
    if (!agentKey) {
      return { ok: false, status: 0, error: "No Tower agent key. Set OVERWING_AGENT_KEY, or call tower_create_agent (needs OVERWING_API_KEY) to mint one for this session." };
    }
    headers.Authorization = `Bearer ${agentKey}`;
  } else if (auth === true || auth === "org") {
    if (!API_KEY) {
      return { ok: false, status: 0, error: "OVERWING_API_KEY is not set. Get a key at " + BASE_URL + "/login or POST " + BASE_URL + "/api/v1/signup." };
    }
    headers.Authorization = `Bearer ${API_KEY}`;
  } else if (auth === "optional" && API_KEY) {
    headers.Authorization = `Bearer ${API_KEY}`;
  }
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
    const msg = describeError(parsed, text.slice(0, 300));
    const retry = res.headers.get("retry-after");
    return { ok: false, status: res.status, error: `${res.status}: ${msg}${retry ? ` (retry after ${retry}s)` : ""}`, body: parsed };
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

const server = new McpServer({ name: "overwing", version: "0.7.0" });

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
      "Works with no API key: 10 evaluations a day, inputs up to 2,000 characters, and the text is not stored. With a key: 250 a day and up, inputs up to 100,000 characters, and your own rule sets. Score any text (typically an LLM's output) against an Overwing rule set. Returns an aggregate verdict of pass, fail, or review, a recommended_action (block, redact, review, or allow), and per-rule answers with probability, confidence, and the rule's action. Act on recommended_action: block means do not send, redact means remove the flagged content and resend, review means ask a human or a slower model, allow means proceed. Prebuilt sets: 'content-safety' (toxicity, PII, self-harm, sexual content, severity) and 'outbound-message', which also takes a context object (recipient, channel, owns_contact_info) so PII that the recipient already owns is not flagged.",
    inputSchema: {
      input: z.string().min(1).max(100_000).describe("The text to evaluate"),
      rule_set: z.string().default("content-safety").describe("Rule set slug"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("Opaque data stored with the evaluation and echoed in webhooks (max 8 KB)"),
      context: contextSchema,
    },
  },
  async ({ input, rule_set, metadata, context }) =>
    reply(await api("POST", "/api/v1/evaluate", { input, rule_set, metadata, context }, "optional"), (b) => {
      const r = b as { id: string; verdict: string; recommended_action?: string; aggregate_score: number; confidence: number; latency_ms: number; results: { rule: string; answer: unknown; confidence: number; verdict: string; action?: string }[]; access?: { remaining_today: number } };
      const rules = r.results.map((x) => `  ${x.rule}: ${x.verdict}${x.verdict === "fail" && x.action ? ` -> ${x.action}` : ""} (answer=${JSON.stringify(x.answer)}, confidence=${x.confidence})`).join("\n");
      const left = r.access ? `\nNo key: ${r.access.remaining_today} free evaluations left today, and the text was not stored. Set OVERWING_API_KEY for 250 a day.` : "";
      return `Verdict: ${r.verdict.toUpperCase()}  recommended_action=${r.recommended_action ?? "n/a"}  score=${r.aggregate_score}  confidence=${r.confidence}  ${r.latency_ms}ms  id=${r.id}\n${rules}${left}`;
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

server.registerTool(
  "atlas_lookup",
  {
    title: "Identify a user agent (Overwing Atlas)",
    description:
      "Say what a User-Agent string claims to be and whether the claim can be trusted, from the Overwing Atlas registry of AI crawlers, fetchers and browser agents. Returns the claimed agent, operator, purpose class, verification method (Web Bot Auth signature, user-agent string only, or unattributable) and a trust note. Works with no API key: 10 lookups a day. With a key, metered per day by Atlas tier: free 100, Pro 10,000, Team 100,000. Use it when deciding whether to serve, block, or pay-gate a request, or to understand who is hitting a site.",
    inputSchema: { user_agent: z.string().min(1).max(2000).describe("The User-Agent header value to identify") },
  },
  async ({ user_agent }) =>
    reply(await api("GET", `/api/v1/atlas/lookup?user_agent=${encodeURIComponent(user_agent)}`, undefined, "optional"), (b) => {
      const r = b as { identified: boolean; claims: { agent: string; operator: string | null; purpose_class: string | null; verification: string | null } | null; trust_note: string; matches: unknown[]; access?: { remaining_today: number } };
      const left = r.access ? `\nKeyless: ${r.access.remaining_today} lookups left today. Set OVERWING_API_KEY for 100 a day.` : "";
      if (!r.identified || !r.claims) return `Not identified. ${r.trust_note}${left}`;
      return `Claims: ${r.claims.agent} (${r.claims.operator ?? "unknown operator"}) · ${r.claims.purpose_class ?? "unclassified"} · verification: ${r.claims.verification ?? "unknown"}\n${r.trust_note}${r.matches.length > 1 ? `\n${r.matches.length - 1} other match(es); see the JSON.` : ""}${left}`;
    }),
);

server.registerTool(
  "atlas_agents",
  {
    title: "Search the agent registry (Overwing Atlas)",
    description: "Browse or search Overwing Atlas, the registry of AI crawlers, fetchers and browser agents: name, operator, user-agent tokens, Web Bot Auth key directory, robots.txt behaviour, and (with Atlas Pro or Team) purpose class, verification, evasion flags and traffic shares. Filter by free text, purpose (training, search, browser, coding), operator, or verification.",
    inputSchema: {
      q: z.string().max(200).optional().describe("Free text over name, operator, user agents, description"),
      purpose: z.string().max(60).optional().describe("Purpose substring, e.g. training, search, browser, fetcher, coding"),
      operator: z.string().max(100).optional(),
      verification: z.string().max(60).optional().describe("e.g. 'Web Bot Auth', 'spoofable', 'Unattributable'"),
      limit: z.number().int().min(1).max(100).default(20),
    },
  },
  async ({ q, purpose, operator, verification, limit }) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (purpose) qs.set("purpose", purpose);
    if (operator) qs.set("operator", operator);
    if (verification) qs.set("verification", verification);
    qs.set("limit", String(limit));
    return reply(await api("GET", `/api/v1/atlas/agents?${qs.toString()}`), (b) => {
      const r = b as { total: number; fields: string; agents: Array<{ slug: string; agent: string; operator: string | null; purpose_class?: string | null; verification?: string | null; user_agent_tokens: string[] }> };
      const lines = r.agents.map((a) => `  ${a.agent} — ${a.operator ?? "?"}${a.purpose_class ? ` · ${a.purpose_class}` : ""}${a.verification ? ` · ${a.verification}` : ""}${a.user_agent_tokens.length ? ` · tokens: ${a.user_agent_tokens.slice(0, 3).join(", ")}` : ""}`);
      return `${r.total} agents match (${r.fields} fields)\n${lines.join("\n")}`;
    });
  },
);

server.registerTool(
  "atlas_summary",
  {
    title: "Agent traffic and spending summary (Overwing Atlas)",
    description: "Public numbers from Overwing Atlas: registry counts by purpose and verification, published browser-agent traffic shares, sector field-scan headlines (e.g. how many OSINT sites carry AI-crawler rules or any agent-payable surface), and the summary of the Agent Consumers report on what agents actually spend. No key needed.",
    inputSchema: {},
  },
  async () =>
    reply(await api("GET", "/api/v1/atlas/summary", undefined, false), (b) => {
      const r = b as { registry: { count: number; operators: number; purpose_classes: Record<string, number>; verification: Record<string, number> }; traffic_shares: Array<{ agent: string; value: number | string; period: string }>; sector_scans: Array<{ sector: string; date: string; headline_findings: Array<{ finding: string }> }>; report_summary: string | null };
      const shares = r.traffic_shares.slice(0, 6).map((t) => `  ${t.agent}: ${typeof t.value === "number" ? `${Math.round(t.value * 1000) / 10}%` : t.value} (${t.period})`).join("\n");
      const scans = r.sector_scans.map((s) => `  ${s.sector} (${s.date}):\n` + s.headline_findings.slice(0, 3).map((f) => `    - ${f.finding}`).join("\n")).join("\n");
      return `Registry: ${r.registry.count} agents, ${r.registry.operators} operators\n  purpose: ${JSON.stringify(r.registry.purpose_classes)}\n  verification: ${JSON.stringify(r.registry.verification)}\nBrowser-agent traffic share:\n${shares}\nField scans:\n${scans}\n\n${(r.report_summary ?? "").slice(0, 1500)}`;
    }),
);


// ---------------------------------------------------------------------------
// Overwing Tower: clearance for agents operating legacy systems.
// Setup tools carry the organization key; operating tools carry the agent key.
// ---------------------------------------------------------------------------

type TowerDecision = { outcome?: string; score?: number | null; reason?: string; results?: { question_id: string; answer: unknown; passed: boolean; probability: number }[]; checks?: { check: string; passed: boolean; detail?: string }[] };
type TowerAction = { action_id: string; operation: string; status: string; dry_run?: boolean; review_id?: string; replayed?: boolean; decision?: TowerDecision; result?: unknown; error?: unknown };

function decisionLines(d: TowerDecision | undefined): string {
  if (!d || typeof d.outcome !== "string") return "";
  const failedChecks = (d.checks ?? []).filter((c) => !c.passed).map((c) => `  check ${c.check}: FAILED${c.detail ? ` (${c.detail})` : ""}`);
  const questions = (d.results ?? []).map((q) => `  ${q.question_id}: ${q.passed ? "pass" : "fail"} (answer=${JSON.stringify(q.answer)}, p=${q.probability})`);
  return [`Decision: ${d.outcome.toUpperCase()}${d.score === null || d.score === undefined ? "" : `  score=${d.score}`}  ${d.reason ?? ""}`, ...failedChecks, ...questions].join("\n");
}

function actionSummary(a: TowerAction): string {
  const next =
    a.status === "pending" ? `Waiting on a person. Poll tower_get_action with ${a.action_id}; do not resubmit.`
    : a.status === "rejected" ? "Rejected. Do not retry the same request; change it or ask a person."
    : a.status === "executed" ? "Executed."
    : a.status === "compensated" ? "Compensated: the original action has been undone."
    : a.dry_run ? "Dry run: nothing was executed."
    : "";
  return [`Action ${a.action_id}  ${a.operation}  status=${a.status}${a.replayed ? "  (replay of an earlier request)" : ""}${a.review_id ? `  review_id=${a.review_id}` : ""}`, decisionLines(a.decision), a.result ? `Result: ${JSON.stringify(a.result)}` : "", next].filter(Boolean).join("\n");
}

/** A policy rejection (422) is an answer, not a transport failure: show the decision. */
function actionReply(result: ApiResult): ReturnType<typeof reply> {
  if (!result.ok && typeof result.body === "object" && result.body !== null && "action_id" in result.body) {
    return reply({ ok: true, status: result.status, body: result.body }, (b) => actionSummary(b as TowerAction));
  }
  return reply(result, (b) => actionSummary(b as TowerAction));
}

const operationInput = z.record(z.string(), z.unknown()).describe("The operation's input, matching its input_schema from tower_capabilities");

server.registerTool(
  "tower_load_template",
  {
    title: "Load the starter workflow (Overwing Tower)",
    description: "Set up Overwing Tower for this organization by loading the starter workflow: email purchase order to order entry, with create_order, update_order and cancel_order against a mock IBM i system, and a starter policy. Idempotent. Uses the organization key. Returns a sample input you can submit. Next: tower_create_agent.",
    inputSchema: {},
  },
  async () =>
    reply(await api("POST", "/api/v1/tower/template", {}, "org"), (b) => {
      const r = b as { workflow: string; created: boolean; operations: string[]; target_system: string };
      return `${r.created ? "Loaded" : "Already present"}: workflow ${r.workflow} on ${r.target_system}. Operations: ${r.operations.join(", ")}. Next: tower_create_agent. A sample create_order input is in the JSON.`;
    }),
);

server.registerTool(
  "tower_create_agent",
  {
    title: "Create an agent identity (Overwing Tower)",
    description: "Create a scoped agent identity and its key. Uses the organization key. Scope it to the operations the agent needs (for example create_order) rather than * where you can. The key is kept in this server's memory and used by the other tower_ tools for the rest of the session; it is returned once so it can be stored as OVERWING_AGENT_KEY. Revoke with tower_revoke_agent.",
    inputSchema: {
      name: z.string().min(1).max(100).describe("A name a person will recognise in the review queue, e.g. order-intake-bot"),
      scopes: z.array(z.string().regex(/^(\*|[a-z][a-z0-9_]{0,63})$/)).min(1).max(50).describe("Operation names this agent may call, or [\"*\"] for all"),
      use_for_session: z.boolean().default(true).describe("Use this key for the other tower_ tools in this session"),
    },
  },
  async ({ name, scopes, use_for_session }) => {
    const result = await api("POST", "/api/v1/tower/agents", { name, scopes }, "org");
    if (result.ok && use_for_session) {
      const key = (result.body as { key?: unknown }).key;
      if (typeof key === "string") agentKey = key;
    }
    return reply(result, (b) => {
      const r = b as { agent_id: string; name: string; scopes: string[]; key: string };
      return `Agent ${r.name} created (${r.agent_id}), scopes: ${r.scopes.join(", ")}.${use_for_session ? " Its key is now in use for this session." : ""}\nKey (shown once; store it as OVERWING_AGENT_KEY, do not share it): ${r.key}`;
    });
  },
);

server.registerTool(
  "tower_list_agents",
  { title: "List agents (Overwing Tower)", description: "List this organization's Tower agents with scopes, status and last use. Keys are never returned. Uses the organization key.", inputSchema: {} },
  async () =>
    reply(await api("GET", "/api/v1/tower/agents", undefined, "org"), (b) => {
      const r = b as { agents: { agent_id: string; name: string; scopes: string[]; status: string; last_used_at: string | null }[]; active_limit: number };
      if (r.agents.length === 0) return "No agents yet. Create one with tower_create_agent.";
      return r.agents.map((a) => `  ${a.name}  ${a.status}  scopes=${a.scopes.join(",")}  last_used=${a.last_used_at ?? "never"}  id=${a.agent_id}`).join("\n");
    }),
);

server.registerTool(
  "tower_revoke_agent",
  { title: "Revoke an agent (Overwing Tower)", description: "Revoke an agent. Its key stops working at once and cannot be restored. Uses the organization key.", inputSchema: { agent_id: z.string().uuid() } },
  async ({ agent_id }) => reply(await api("DELETE", `/api/v1/tower/agents/${encodeURIComponent(agent_id)}`, undefined, "org"), () => `Agent ${agent_id} revoked.`),
);

server.registerTool(
  "tower_capabilities",
  {
    title: "What may I do? (Overwing Tower)",
    description: "List the operations this agent is allowed to call, each with the JSON Schema its input must match and its compensating operation. Call this first; build inputs from the schema rather than guessing. Uses the agent key.",
    inputSchema: {},
  },
  async () =>
    reply(await api("GET", "/api/v1/tower/capabilities", undefined, "agent"), (b) => {
      const r = b as { agent: { name: string; scopes: string[] }; operations: { operation: string; workflow: string; is_write: boolean; compensating_operation: string | null; input_schema: { required?: string[] } }[] };
      const ops = r.operations.map((o) => `  ${o.operation} (${o.workflow})${o.is_write ? " write" : " read"}${o.compensating_operation ? `, undo with ${o.compensating_operation}` : ""}; required: ${(o.input_schema.required ?? []).join(", ") || "none"}`);
      return `Agent ${r.agent.name}, scopes ${r.agent.scopes.join(",")}\n${ops.join("\n")}\nFull input schemas are in the JSON.`;
    }),
);

server.registerTool(
  "tower_decide",
  {
    title: "Would this be allowed? (Overwing Tower)",
    description: "Ask Tower how it would rule on an operation without doing anything: auto (would execute), review (a person must approve), or reject. Returns the score, the reason, and each policy question's answer. No side effects. Uses the agent key.",
    inputSchema: { operation: z.string().min(1).max(64), input: operationInput },
  },
  async ({ operation, input }) => reply(await api("POST", "/api/v1/tower/decide", { operation, input }, "agent"), (b) => decisionLines(b as TowerDecision)),
);

server.registerTool(
  "tower_submit_action",
  {
    title: "Request an action (Overwing Tower)",
    description: "Ask Tower to perform an operation on the legacy system. Tower decides: executed (done), pending (a person must approve; poll tower_get_action, do not resubmit), or rejected (do not retry unchanged). Always send an idempotency_key that is stable for this business request, such as the source message id: repeating a key returns the original outcome instead of acting twice. Set dry_run to see the decision without executing. Uses the agent key.",
    inputSchema: {
      operation: z.string().min(1).max(64),
      input: operationInput,
      idempotency_key: z.string().min(1).max(128).describe("Stable per business request; reuse it on retries"),
      dry_run: z.boolean().optional(),
    },
  },
  async ({ operation, input, idempotency_key, dry_run }) => actionReply(await api("POST", "/api/v1/tower/actions", { operation, input, idempotency_key, dry_run }, "agent")),
);

server.registerTool(
  "tower_get_action",
  { title: "Get an action (Overwing Tower)", description: "Status and result of an action: pending, approved, executed, failed, compensated, or rejected. Use it to poll an action that is waiting on human review. Uses the agent key.", inputSchema: { action_id: z.string().uuid() } },
  async ({ action_id }) => actionReply(await api("GET", `/api/v1/tower/actions/${encodeURIComponent(action_id)}`, undefined, "agent")),
);

server.registerTool(
  "tower_compensate",
  { title: "Undo an executed action (Overwing Tower)", description: "Run the compensating operation for an executed action, for example cancel the order that create_order made. Runs once; repeating it returns the first outcome. Uses the agent key.", inputSchema: { action_id: z.string().uuid() } },
  async ({ action_id }) => actionReply(await api("POST", `/api/v1/tower/actions/${encodeURIComponent(action_id)}/compensate`, {}, "agent")),
);

server.registerTool(
  "tower_get_receipt",
  { title: "Get a receipt (Overwing Tower)", description: "Fetch one signed receipt by id or by sequence number: the payload, its hash, the previous link's hash, and the Ed25519 signature. Uses the agent key.", inputSchema: { id: z.string().min(1).max(64).describe("Receipt id or sequence number") } },
  async ({ id }) => reply(await api("GET", `/api/v1/tower/receipts/${encodeURIComponent(id)}`, undefined, "agent")),
);

server.registerTool(
  "tower_verify_receipts",
  {
    title: "Verify the receipt chain (Overwing Tower)",
    description: "Recompute every hash and check every signature over a range of this organization's receipts. Reports the first break, if any. Defaults to the whole chain (up to 5,000 links per call). Uses the agent key.",
    inputSchema: { from: z.number().int().min(1).optional(), to: z.number().int().min(1).optional() },
  },
  async ({ from, to }) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", String(from));
    if (to) qs.set("to", String(to));
    const q = qs.toString();
    return reply(await api("GET", `/api/v1/tower/receipts/verify${q ? `?${q}` : ""}`, undefined, "agent"), (b) => {
      const r = b as { ok: boolean; checked: number; from: number; to: number; first_break: { sequence: number; problem: string } | null };
      return r.ok ? `Chain intact: ${r.checked} receipts verified (${r.from} to ${r.to}).` : `Chain BROKEN at sequence ${r.first_break?.sequence}: ${r.first_break?.problem}. ${r.checked} verified before the break.`;
    });
  },
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
