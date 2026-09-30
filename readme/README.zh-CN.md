<p align="center">
  <a href="https://overwing.ai">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../assets/wordmark-dark.svg">
      <img src="../assets/wordmark.svg" alt="Overwing" width="220">
    </picture>
  </a>
</p>

<p align="center"><strong>把大模型输出的护栏（Guardrails）做成 MCP 工具。</strong><br>
为任意文本做安全与质量方面的评分，通常在 500 毫秒内返回 <code>pass</code>（通过）/ <code>fail</code>（不通过）/ <code>review</code>（需复核）判定，并附带经过校准的置信度。</p>

<p align="center">
  <a href="https://www.npmjs.com/package/overwing-mcp"><img alt="npm" src="https://img.shields.io/npm/v/overwing-mcp?color=0B1220&label=overwing-mcp"></a>
  <a href="https://overwing.ai/docs"><img alt="API reference" src="https://img.shields.io/badge/API-reference-0B1220"></a>
  <a href="https://overwing.ai"><img alt="agents welcome" src="https://overwing.ai/badge.svg"></a>
  <a href="https://mcpmarket.com/server/overwing?utm_source=readme&utm_medium=badge"><img alt="Listed on MCP Market" src="https://mcpmarket.com/badge/server/overwing.svg?theme=dark"></a>
</p>

<p align="center"><a href="../README.md">English</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a></p>

---

**Overwing** 是一个在模型输出发出之前先做检查的 API。本包把它开放给所有支持 MCP 的智能体（agent）：Claude Desktop、Claude Code、Cursor、Windsurf、VS Code、OpenAI 的 Agents SDK，以及其他任何支持 [Model Context Protocol](https://modelcontextprotocol.io) 的客户端。

- **给出明确的判定，而不是凭感觉。** 每条规则都会返回一个带类型的答案、一个概率和一个置信度。`fail` 表示有规则命中；`review` 表示模型把握不足；`pass` 表示两者都不是。
- **预置 `content-safety` 和 `outbound-message` 规则集**：攻击性言论（toxicity）、个人信息、机密信息泄露、自残、色情内容、严重程度。也可以用自然语言编写自己的规则。
- **为智能体而设计。** 注册、付费、评估、轮换密钥、取消订阅，全部通过 JSON 完成。没有 CAPTCHA，也不需要浏览器。参见 [overwing.ai/llms.txt](https://overwing.ai/llms.txt)。

不用安装也能试用：把文本粘贴到 [overwing.ai](https://overwing.ai) 的控制台即可。

## 托管版，无需安装

同样的 24 个工具也可以通过 `https://overwing.ai/mcp`（Streamable HTTP）直接使用。任何支持远程 MCP URL 的客户端都可以连接：

```bash
claude mcp add --transport http overwing https://overwing.ai/mcp
```

`evaluate`、`atlas_lookup`、`atlas_summary` 和 `list_plans` 不需要 key。其余工具需要在连接上发送 `Authorization: Bearer ow_live_...`。

## 安装

没有 API key 也能使用：`evaluate` 和 `atlas_lookup` 每天各可免费调用 10 次，不带 key 发送的文本不会被存储。需要更高额度时，可以在 [overwing.ai/login](https://overwing.ai/login) 获取 key，或者让你的智能体自行注册：

```bash
curl -X POST https://overwing.ai/api/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"at-least-12-chars"}'
```

**Claude Code**

```bash
claude mcp add overwing -e OVERWING_API_KEY=ow_live_... -- npx -y overwing-mcp
```

**Claude Desktop、Cursor、Windsurf、VS Code**（任何使用 JSON 配置的客户端）

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

如需指向自托管部署，请设置 `OVERWING_BASE_URL`。需要 Node 20 及以上版本。

使用 [Overwing Tower](https://overwing.ai/products/tower) 时，设置 `OVERWING_AGENT_KEY=ow_agent_...` 即可以某个已有 agent 的身份进行操作。如果没有设置，`tower_create_agent` 会用组织 key 签发一个 agent key，并在本次会话期间保存在内存中。

`evaluate`、`atlas_lookup`、`atlas_summary` 和 `list_plans` 完全不需要 key。

输入文本可以是任何语言。2026-09-29 已在西班牙语、葡萄牙语、法语、德语、日语、简体中文、韩语、阿拉伯语和印地语上做过测试：这只是小规模测试，并非基准测试。返回结果为英文。

## 工具

| 工具 | 功能 |
| --- | --- |
| `evaluate` | 按某个规则集为一段文本评分。返回判定（verdict）、`recommended_action`（建议动作：block 拦截、redact 脱敏、review 复核或 allow 放行）、综合得分、置信度、耗时，以及每条规则的结果和该规则对应的动作。可选传入 `context` 对象（收件人、渠道、信息归属），供 `outbound-message` 这类感知上下文的规则集读取。 |
| `evaluate_batch` | 一次调用为最多 50 段文本评分，返回汇总以及每一项的判定和建议动作。 |
| `list_rule_sets` · `get_rule_set` · `create_rule_set` | 浏览预置规则集，或定义自己的规则：是非题、分类题或分级评分。 |
| `get_evaluation` · `list_evaluations` | 读取已存储的结果，可按判定或规则集筛选，用游标（cursor）翻页。 |
| `atlas_lookup` | Overwing Atlas：说明一个 User-Agent 字符串自称是什么，以及这一声明是否可信（Web Bot Auth、可伪造的字符串，或无法归属）。无需 key，每天 10 次；使用免费 key 每天 100 次。 |
| `atlas_agents` · `atlas_summary` | 搜索 AI 爬虫、抓取器和浏览器智能体的注册表；获取流量占比、行业实地扫描的要点，以及智能体消费情况摘要。 |
| `tower_load_template` · `tower_create_agent` · `tower_list_agents` · `tower_revoke_agent` | Overwing Tower 的初始化，使用组织 key：加载入门用的订单录入工作流，然后签发一个限定权限范围的 agent 身份。新的 agent key 会在本次会话的后续调用中使用。 |
| `tower_capabilities` · `tower_decide` · `tower_submit_action` · `tower_get_action` · `tower_compensate` | Overwing Tower 的日常操作，使用 agent key：查看自己可以调用哪些操作及其输入 schema，询问某个请求会被如何裁定，提交请求（已执行、等待人工审核或被拒绝），轮询状态，撤销操作。 |
| `tower_get_receipt` · `tower_verify_receipts` | 读取一份已签名的回执，或重新计算链上的每一个哈希和签名。 |
| `get_usage` · `whoami` · `list_plans` | 今日配额、key 所属的组织，以及公开的套餐目录。 |

`overwing://guide` 资源会返回完整的纯文本 API 指南。

## 示例

对你的智能体说：

> 发送之前帮我检查一下这条回复："Reach me at dana@example.com or 555-0142 to sort out the refund."

它会调用 `evaluate`，并得到如下结果：

```
Verdict: FAIL  score=0.82  confidence=0.97  251ms
  toxicity: pass (answer="safe", confidence=1)
  pii_detected: fail (answer=true, confidence=0.98)
  self_harm: pass (answer=false, confidence=1)
  sexual_content: pass (answer="none", confidence=1)
  severity: pass (answer=0.03, confidence=0.97)
```

## 判定是如何得出的

每条规则都有一个失败条件、一个可选的复核阈值和一个权重。

- **fail**：某条规则的失败条件被命中。应拦截、脱敏或重新生成。
- **review**：没有规则失败，但某条规则的置信度低于其阈值。应转交人工或更慢的模型处理。
- **pass**：其余所有情况。

每条规则还带有一个 **action**（动作：`block`、`redact` 或 `review`），响应会把它们汇总成一个 `recommended_action`：优先级为 `block` 高于 `redact`，`redact` 高于 `review`，`review` 高于 `allow`。请根据这个字段做分支处理。使用 `outbound-message` 规则集时传入 `context` 对象（收件人、渠道、`owns_contact_info`），规则会读取它，因此在回复某位客户时，出现这位客户自己的电话号码不会被标记。

`aggregate_score` 取值 0 到 1（每条规则 pass = 1、review = 0.5、fail = 0，再按权重加权）。`confidence` 取各条规则中的最小值。

## 价格

免费：每天 250 次评估。另有付费套餐。每个套餐都包含全部接口、自定义规则集、webhook 和控制台。详情见 [overwing.ai/#pricing](https://overwing.ai/#pricing) 或 `GET https://overwing.ai/api/v1/plans`。

## 链接

- 网站与在线演示：[overwing.ai](https://overwing.ai)
- API 参考：[overwing.ai/docs](https://overwing.ai/docs)
- OpenAPI：[overwing.ai/api/v1/openapi.json](https://overwing.ai/api/v1/openapi.json)
- 面向智能体的指南：[overwing.ai/llms.txt](https://overwing.ai/llms.txt)
- 支持：support@overwing.ai

## 开发

```bash
npm install
npm run build
OVERWING_API_KEY=ow_live_... node dist/index.js
```

MIT © Overwing。判定由 TypeSafe 的 Jev System One 模型生成；Overwing 与 TypeSafe 没有隶属关系。
