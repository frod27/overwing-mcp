<p align="center">
  <a href="https://overwing.ai">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="../assets/wordmark-dark.svg">
      <img src="../assets/wordmark.svg" alt="Overwing" width="220">
    </picture>
  </a>
</p>

<p align="center"><strong>LLM 출력을 위한 가드레일(Guardrails)을 MCP 도구로.</strong><br>
어떤 텍스트든 안전성과 품질 관점에서 점수를 매기고, <code>pass</code>(통과) / <code>fail</code>(실패) / <code>review</code>(검토 필요) 판정을 보정된 신뢰도와 함께 보통 500 ms 안에 돌려줍니다.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/overwing-mcp"><img alt="npm" src="https://img.shields.io/npm/v/overwing-mcp?color=0B1220&label=overwing-mcp"></a>
  <a href="https://overwing.ai/docs"><img alt="API reference" src="https://img.shields.io/badge/API-reference-0B1220"></a>
  <a href="https://overwing.ai"><img alt="agents welcome" src="https://overwing.ai/badge.svg"></a>
  <a href="https://mcpmarket.com/server/overwing?utm_source=readme&utm_medium=badge"><img alt="Listed on MCP Market" src="https://mcpmarket.com/badge/server/overwing.svg?theme=dark"></a>
</p>

<p align="center"><a href="../README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a></p>

---

**Overwing**은 모델이 내놓은 출력을 내보내기 전에 검사하는 API입니다. 이 패키지는 그 API를 MCP를 지원하는 모든 에이전트에서 쓸 수 있게 해 줍니다. Claude Desktop, Claude Code, Cursor, Windsurf, VS Code, OpenAI의 Agents SDK는 물론, [Model Context Protocol](https://modelcontextprotocol.io)을 지원하는 클라이언트라면 무엇이든 사용할 수 있습니다.

- **감이 아니라 명확한 판정.** 모든 규칙은 타입이 정해진 답, 확률, 신뢰도를 반환합니다. `fail`은 규칙에 걸렸다는 뜻이고, `review`는 모델이 확신하지 못했다는 뜻이며, `pass`는 둘 다 아니라는 뜻입니다.
- **기본 제공 `content-safety` 및 `outbound-message` 규칙 세트**: 유해 표현(toxicity), 개인정보, 기밀 정보 유출, 자해, 성적 콘텐츠, 심각도. 자연어로 직접 규칙을 작성할 수도 있습니다.
- **에이전트를 위한 설계.** 가입, 결제, 평가, 키 교체, 해지까지 모두 JSON으로 처리합니다. CAPTCHA도 브라우저도 필요 없습니다. [overwing.ai/llms.txt](https://overwing.ai/llms.txt)를 참고하세요.

설치 없이 바로 써 볼 수도 있습니다. [overwing.ai](https://overwing.ai)의 콘솔에 텍스트를 붙여 넣으세요.

## 호스팅 버전(설치 불필요)

같은 24개 도구를 `https://overwing.ai/mcp`(Streamable HTTP)에서도 제공합니다. 원격 MCP URL을 지정할 수 있는 클라이언트라면 바로 연결할 수 있습니다.

```bash
claude mcp add --transport http overwing https://overwing.ai/mcp
```

`evaluate`, `atlas_lookup`, `atlas_summary`, `list_plans`는 키 없이 사용할 수 있습니다. 나머지는 연결 시 `Authorization: Bearer ow_live_...`를 보내야 합니다.

## 설치

API 키 없이도 동작합니다. `evaluate`와 `atlas_lookup`은 각각 하루 10회까지 무료로 실행할 수 있고, 키 없이 보낸 텍스트는 저장되지 않습니다. 더 많이 쓰려면 [overwing.ai/login](https://overwing.ai/login)에서 키를 발급받거나, 에이전트가 직접 가입하게 하세요.

```bash
curl -X POST https://overwing.ai/api/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"at-least-12-chars"}'
```

**Claude Code**

```bash
claude mcp add overwing -e OVERWING_API_KEY=ow_live_... -- npx -y overwing-mcp
```

**Claude Desktop, Cursor, Windsurf, VS Code** (JSON으로 설정하는 모든 클라이언트)

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

셀프 호스팅 배포를 가리키려면 `OVERWING_BASE_URL`을 설정하세요. Node 20 이상이 필요합니다.

[Overwing Tower](https://overwing.ai/products/tower)에서는 `OVERWING_AGENT_KEY=ow_agent_...`를 설정하면 기존 에이전트로서 동작합니다. 설정하지 않으면 `tower_create_agent`가 조직 키로 에이전트 키를 발급하고, 세션 동안 메모리에만 보관합니다.

`evaluate`, `atlas_lookup`, `atlas_summary`, `list_plans`는 키가 전혀 없어도 동작합니다.

입력 텍스트는 어떤 언어든 가능합니다. 2026-09-29에 스페인어, 포르투갈어, 프랑스어, 독일어, 일본어, 중국어 간체, 한국어, 아랍어, 힌디어로 테스트했습니다. 소규모 테스트이며 벤치마크는 아닙니다. 결과는 영어로 반환됩니다.

## 도구

| 도구 | 설명 |
| --- | --- |
| `evaluate` | 텍스트 하나를 규칙 세트에 따라 평가합니다. 판정(verdict), `recommended_action`(권장 조치: block 차단, redact 마스킹, review 검토, allow 허용), 종합 점수, 신뢰도, 지연 시간, 그리고 규칙별 결과와 각 규칙의 조치를 반환합니다. 선택적으로 `context` 객체(수신자, 채널, 정보 소유 여부)를 넘길 수 있으며, `outbound-message`처럼 컨텍스트를 인식하는 규칙 세트가 이를 읽습니다. |
| `evaluate_batch` | 한 번의 호출로 최대 50개의 텍스트를 평가하고, 요약과 항목별 판정 및 권장 조치를 반환합니다. |
| `list_rule_sets` · `get_rule_set` · `create_rule_set` | 기본 제공 규칙 세트를 살펴보거나 직접 규칙을 정의합니다. 예/아니오 질문, 분류, 단계별 척도 평가를 쓸 수 있습니다. |
| `get_evaluation` · `list_evaluations` | 저장된 결과를 조회합니다. 판정이나 규칙 세트로 필터링하고 커서로 페이지를 넘길 수 있습니다. |
| `atlas_lookup` | Overwing Atlas: User-Agent 문자열이 무엇이라고 자칭하는지, 그리고 그 주장을 믿을 수 있는지(Web Bot Auth, 위조 가능한 문자열, 또는 귀속 불가)를 알려 줍니다. 키 없이 하루 10회, 무료 키로는 하루 100회까지 사용할 수 있습니다. |
| `atlas_agents` · `atlas_summary` | AI 크롤러, 페처, 브라우저 에이전트 레지스트리를 검색합니다. 트래픽 점유율, 업종별 현장 스캔의 주요 결과, 에이전트 지출 요약도 받아볼 수 있습니다. |
| `tower_load_template` · `tower_create_agent` · `tower_list_agents` · `tower_revoke_agent` | Overwing Tower 설정(조직 키 사용): 스타터용 주문 입력 워크플로를 불러온 다음, 범위가 제한된 에이전트 ID를 발급합니다. 새 에이전트 키는 세션의 나머지 동안 사용됩니다. |
| `tower_capabilities` · `tower_decide` · `tower_submit_action` · `tower_get_action` · `tower_compensate` | Overwing Tower 운영(에이전트 키 사용): 호출할 수 있는 오퍼레이션과 입력 스키마를 확인하고, 요청이 어떻게 판정될지 물어보고, 요청을 제출하고(실행됨, 사람의 검토 대기, 또는 거부됨), 상태를 폴링하고, 실행을 되돌립니다. |
| `tower_get_receipt` · `tower_verify_receipts` | 서명된 영수증을 조회하거나, 체인의 모든 해시와 서명을 다시 계산합니다. |
| `get_usage` · `whoami` · `list_plans` | 오늘의 할당량, 키가 속한 조직, 공개 요금제 목록. |

`overwing://guide` 리소스는 일반 텍스트로 된 전체 API 가이드를 반환합니다.

## 데이터 처리와 보안

이 서버가 사용자의 컴퓨터에서 하는 일: 환경 변수 3개(`OVERWING_API_KEY`, `OVERWING_AGENT_KEY`, `OVERWING_BASE_URL`)를 읽고 Overwing API에 HTTPS 요청을 보냅니다. 파일을 읽지 않고, 명령을 실행하지 않으며, 다른 호스트와 통신하지 않습니다. 런타임 의존성은 2개(`@modelcontextprotocol/sdk`, `zod`)이고, 서버 전체가 파일 하나입니다: [src/index.ts](../src/index.ts).

평가하는 텍스트의 처리:

- 텍스트는 Overwing API로 전송되고, 거기서 TypeSafe로 전송됩니다. TypeSafe의 Jev 모델이 판정을 내립니다. 모델 학습에는 사용되지 않습니다.
- **키가 없으면** 텍스트는 저장되지 않습니다.
- **키가 있으면** 텍스트, context, 판정이 저장되며, 삭제하기 전까지 `get_evaluation`으로 다시 읽을 수 있습니다. 이를 바꾸려면:
  - `evaluate` 또는 `evaluate_batch`에 `store: false`를 넘기면 해당 호출의 텍스트와 context는 저장되지 않습니다.
  - 조직에 `store_inputs: false`를 설정하면(`PATCH /api/v1/org` 또는 대시보드) 전혀 저장되지 않습니다.
  - 조직에 `retention_days`를 설정하면 그 일수가 지난 평가는 삭제됩니다.
- 전송 구간은 TLS로 암호화되고, 데이터베이스는 저장 시 AES-256으로 암호화됩니다.

에이전트에는 권한이 제한된 키를 주세요. 스코프가 `evaluate`인 키는 검사를 실행하고 규칙 세트를 읽을 수만 있습니다. 저장된 평가 읽기, 규칙 세트 변경, 키·웹훅·결제 관리, 삭제는 할 수 없습니다.

```bash
curl -X POST https://overwing.ai/api/v1/api-keys \
  -H "Authorization: Bearer ow_live_..." -H "Content-Type: application/json" \
  -d '{"name":"agent","scope":"evaluate"}'
```

Overwing은 신생 서비스이며 아직 독립적인 보안 감사를 받지 않았습니다. 하위 처리자와 아직 하지 않은 일을 포함한 전체 내용은 [overwing.ai/security](https://overwing.ai/security)(영어)에, 개인정보 처리방침은 [overwing.ai/privacy](https://overwing.ai/privacy)(영어)에 있습니다. 취약점 신고 방법은 [SECURITY.md](../SECURITY.md)를 참고하세요.

## 예시

에이전트에게 이렇게 요청합니다.

> 보내기 전에 이 답장을 검사해 줘: "Reach me at dana@example.com or 555-0142 to sort out the refund."

에이전트는 `evaluate`를 호출하고 다음 결과를 받습니다.

```
Verdict: FAIL  score=0.82  confidence=0.97  251ms
  toxicity: pass (answer="safe", confidence=1)
  pii_detected: fail (answer=true, confidence=0.98)
  self_harm: pass (answer=false, confidence=1)
  sexual_content: pass (answer="none", confidence=1)
  severity: pass (answer=0.03, confidence=0.97)
```

## 판정 방식

각 규칙에는 fail 조건, 선택적인 review 임계값, 가중치가 있습니다.

- **fail**: 어떤 규칙의 fail 조건에 해당했습니다. 차단하거나, 마스킹하거나, 다시 생성하세요.
- **review**: fail은 없지만, 어떤 규칙의 신뢰도가 임계값보다 낮았습니다. 사람이나 더 느린 모델에게 넘기세요.
- **pass**: 그 밖의 모든 경우.

모든 규칙에는 **action**(`block`, `redact`, `review` 중 하나)도 지정되어 있으며, 응답은 이를 하나의 `recommended_action`으로 합칩니다. 우선순위는 `block`, `redact`, `review`, `allow` 순입니다. 이 필드를 기준으로 분기하세요. `outbound-message` 규칙 세트에 `context` 객체(수신자, 채널, `owns_contact_info`)를 넘기면 규칙이 이를 읽기 때문에, 고객 본인에게 보내는 답장에 들어 있는 그 고객 자신의 전화번호는 문제로 표시되지 않습니다.

`aggregate_score`는 0에서 1 사이의 값입니다(규칙별로 pass = 1, review = 0.5, fail = 0을 가중 평균). `confidence`는 모든 규칙 중 최솟값입니다.

## 요금

무료: 하루 250회 평가. 유료 요금제도 있습니다. 모든 요금제에 전체 엔드포인트, 커스텀 규칙 세트, 웹훅, 대시보드가 포함됩니다. 자세한 내용은 [overwing.ai/#pricing](https://overwing.ai/#pricing) 또는 `GET https://overwing.ai/api/v1/plans`에서 확인하세요.

## 링크

- 웹사이트 및 라이브 데모: [overwing.ai](https://overwing.ai)
- API 레퍼런스: [overwing.ai/docs](https://overwing.ai/docs)
- OpenAPI: [overwing.ai/api/v1/openapi.json](https://overwing.ai/api/v1/openapi.json)
- 에이전트용 가이드: [overwing.ai/llms.txt](https://overwing.ai/llms.txt)
- 지원: support@overwing.ai

## 개발

```bash
npm install
npm run build
OVERWING_API_KEY=ow_live_... node dist/index.js
```

MIT © Overwing. 판정은 TypeSafe의 Jev System One 모델이 생성합니다. Overwing은 TypeSafe와 제휴 관계가 아닙니다.
