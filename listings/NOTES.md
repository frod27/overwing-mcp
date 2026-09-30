# Localization notes

All zh-CN, ja and ko text in `listings/listings.json` and `readme/README.*.md` was written by a model (Claude) on 2026-09-30. It has NOT been reviewed by a native speaker. Have one read it before it goes on a marketplace.

The "Data handling and security" section in the three translated READMEs was added later the same day, translated by a model from the English README, and is likewise unreviewed.

Sources: the fact sheet given for this task, `README.md`, and `src/index.ts` (24 registered tools, counted).

## Discrepancies between README.md and the fact sheet

README.md was not changed apart from the language-links line. The translations follow the fact sheet where they differ.

1. **Paid price.** README.md "Pricing" says "Paid plans from $29/month". The fact sheet says not to state paid prices. The three translated READMEs say only "paid plans are also available" and link to the pricing page. The English README still has the price.
2. **Stale example output.** The example block in README.md shows `Verdict: FAIL  score=... confidence=... 251ms`. The current `evaluate` summary in `src/index.ts` also prints `recommended_action=...`, `id=...`, and `-> action` on failed rules. Code blocks were left identical in all four READMEs as instructed.
3. **Only one prebuilt rule set in the bullets.** README.md's feature bullet and tools table ("Browse the prebuilt set") mention only `content-safety`; the fact sheet and `src/index.ts` name two (`content-safety`, `outbound-message`). Translations follow the README wording; the listings name both.
4. **Not in README.md at all** (so not in the translated READMEs, only in the listings): the 2,000-character keyless input limit, the confidential-leak (passwords, keys) check, the multilingual test of 2026-09-29, Tower's pilot status, and "a calibrated signal, not a guarantee". Consider adding the any-language note to the READMEs; it matters most to exactly these readers.
5. **"compliance" and "under 500 ms".** README.md's header says text is scored for "safety, quality and compliance" and verdicts arrive "in under 500 ms". Both were translated as written (合规 / コンプライアンス / 컴플라이언스). The word is about scoring text, not a certification claim, but in Chinese especially 合规 could be read as a regulatory claim. The listings avoid both the word and the latency figure.

## Character counts (Python `len`, i.e. code points, including spaces and ASCII)

| Field | limit | en | zh-CN | ja | ko |
| --- | --- | --- | --- | --- | --- |
| name | - | 35 | 21 | 35 | 33 |
| tagline | 60 | 41 | 28 | 31 | 36 |
| short_description | 100 | 95 | 76 | 84 | 84 |
| description | ~300-500 | 508 | 487 | 564 | 583 |
| keywords (count) | 8-14 | 12 | 14 | 13 | 14 |
| category_hint | - | 43 | 9 | 30 | 22 |

The ja and ko descriptions run over 500 because they carry a lot of ASCII (tool values, product names) and, for Korean, spaces. If a marketplace has a hard 500 limit, cut the Tower sentence first, then the "rule names and fields are in English" sentence.

## zh-CN: check these

- **敏感词** is in `keywords` only. Developers search for it, but it usually means keyword-blocklist filtering, and Overwing is model-based, not a word list. Decide whether the search traffic is worth the mismatch. It is deliberately not used in the name or description.
- **脱敏** glosses `redact`. Overwing returns `redact` as a recommended action; nothing in `src/index.ts` shows it returning masked text. The description says "建议动作 ... redact 脱敏", which is accurate, but a reader searching 脱敏 may expect a masking tool.
- **护栏** for guardrails is current usage in LLM circles but still less common than 内容审核 / 内容安全; both are in the name.
- **攻击性言论** for toxicity. Alternatives: 有害言论, 辱骂/不当言论. **色情内容** for sexual content (README: also 自残 for self-harm, 严重程度 for severity).
- **智能体** for agent; the README keeps "agent" in English for Tower identities ("agent key", "agent 身份"). Check the mix reads naturally.
- **放行审批** for Tower's "clearance" is my coinage; nothing standard exists.
- **大模型输出** used for "LLM output" throughout.
- README: "给出明确的判定，而不是凭感觉" for "Real verdicts, not vibes"; "行业实地扫描" for "sector field-scan"; "回执" for receipt; "无法归属" for unattributable; "套餐" for plans; "控制台" for both the landing-page console and the dashboard (the English uses two words).
- "已在简体中文等 9 种语言上做过小规模测试" is the only multilingual claim; it must stay hedged.

## ja: check these

- **較正済みの信頼度 / 較正済みのシグナル** for calibrated confidence/signal. 較正 is correct but formal; キャリブレーション済み is the common engineering alternative.
- **有害表現** for toxicity (alternatives: 有害コンテンツ, 誹謗中傷). **深刻度** for severity (alternative: 重大度). **自傷** for self-harm.
- **マスキング** glosses `redact` (same caveat as 脱敏 above: it is a recommended action, not a masking feature). **遮断** for block (alternative: ブロック).
- **要確認** glosses `review`.
- **クローラー判定 / User-Agent 判定** as keywords: I am not sure these are typed as-is; ボット判定, クローラー検出, ユーザーエージェント 判定 are candidates.
- **クリアランス機能** for Tower's clearance is a loanword guess; 実行許可 or 承認 may read better.
- **情報漏えい** spelling (vs 情報漏洩); both are in use, government style prefers 漏えい.
- README: "雰囲気ではなく、明確な判定を。" for "Real verdicts, not vibes"; "帰属不明" for unattributable; "フィールドスキャン", "受注入力ワークフロー", "レシート" (receipt), "裁定" (ruled).
- Name uses a full-width colon and "・"; check against the marketplace's title conventions.

## ko: check these

- **보정된 신뢰도 / 보정된 신호** for calibrated; 캘리브레이션된 is the alternative.
- **유해 표현** for toxicity (alternatives: 유해성, 혐오 표현, which is narrower). **심각도** for severity.
- **마스킹** glosses `redact` (same caveat). **콘텐츠 검수** vs **콘텐츠 모더레이션**: both are in keywords; 모더레이션 is in the name. 검수 may read as QA/inspection rather than moderation to some readers.
- **민감정보** has a specific legal meaning in Korean privacy law (a defined category of personal data). Here it is used loosely for passwords and keys. A reviewer may prefer 기밀 정보 or 비밀 정보 in the tagline and description, keeping 민감정보 only as a keyword.
- **승인 절차** for Tower's clearance; **운영 주체** for operator; **자칭** for "claims to be".
- **크롤러 식별 / User-Agent 식별** keywords: 봇 탐지, 크롤러 탐지 are candidates.
- README: "감이 아니라 명확한 판정." for "Real verdicts, not vibes"; "영수증" for receipt; "귀속 불가" for unattributable; "현장 스캔" for field scan; "요금제" for plans. Sentence endings are 합니다-style throughout.

## All three

- Field names, values (`pass`/`fail`/`review`, `block`/`redact`/`review`/`allow`), tool names and product names are left in English with a gloss on first use.
- The example prompt is translated but the quoted message inside it stays in English so it still matches the unchanged output block.
- Badge alt text is left in English.
- No compliance, certification, customer, ranking or accuracy claims were added, and no paid prices.
- Relative links: `README.md` links to `readme/README.*.md`; the translations link to `../README.md`, siblings, and `../assets/`. These resolve on GitHub. On npmjs.com relative links in the README generally do not resolve unless the package has a repository field it can rewrite against, and `readme/` is not in the published package; check the rendered npm page after the next publish.

## Changes made after the first draft (2026-09-30)
- English README and all three translations: dropped "compliance" from the header (it could read as a regulatory claim), said "usually" before "under 500 ms", named both prebuilt rule sets, and added the any-language note.
- Korean tagline and description: 민감정보 replaced with 기밀 정보 where it refers to passwords and keys, because 민감정보 has a defined meaning in Korean privacy law. It stays in the keywords as a search term.
