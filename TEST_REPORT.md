# Test Report — Kesar & Co. Support Copilot

**Candidate:** not recorded. **Platform:** n8n Cloud. **Final model:** models/gemini-3.5-flash-lite.

## 1. Correctness standard

Expected labels come from the frozen human-authored checklist grounded in official emails/orders/FAQ. No official answer key is provided. Raw fields and actions are compared automatically; content, policy and usefulness require manual review. E04 secondary intent is a judgment call.

## 2. Email-by-email comparison

| Email | Expected intent/action | V1 intent/action | Original V2 intent/action | Final intent/action | Final notes |
|---|---|---|---|---|---|
| E01 | order_status / draft_reply | order_status / draft_reply / draft | order_status / draft_reply / none | order_status / draft_reply / none | Shipped, estimated 2026-11-21; authorized tracking only. |
| E02 | product_query / draft_reply | product_query / draft_reply / draft | product_query / draft_reply / none | product_query / draft_reply / none | Serum suitable for oily skin and vegan, FAQ 7. |
| E03 | return_refund / ticket_and_draft | return_refund / ticket_and_draft / generic | return_refund / ticket_and_draft / none | return_refund / ticket_and_draft / return_policy | Four days, sealed, INR 899 merchandise, INR 79 fee excluded. |
| E04 | complaint / ticket_and_draft | complaint / ticket_and_draft / generic | complaint / ticket_and_draft / none | complaint / ticket_and_draft / none | Extra return_refund secondary versus frozen expected checklist; judgment call. |
| E05 | order_status / draft_reply | — not run | — not run | order_status / draft_reply / none | Hinglish; estimated 2026-11-23, no travel guarantee. |
| E06 | other / log_only | — not run | — not run | other / log_only / log_only | Spam, no reply or URL access. |
| E07 | order_status / draft_reply | order_status / draft_reply / draft | order_status / draft_reply / privacy | order_status / draft_reply / privacy | No tracking, address, owner email or order details disclosed. |
| E08 | complaint / ticket_and_draft | complaint / ticket_and_draft / generic | complaint / ticket_and_draft / none | complaint / ticket_and_draft / none | Angry leaking complaint; High priority, photos and verification. |
| E09 | product_query / draft_reply | — not run | — not run | product_query / draft_reply / none | Hindi; Guwahati 6–8 business days after dispatch; COD kit INR 3499 plus INR 49. |
| E10 | order_status / draft_reply | order_status / draft_reply / generic | order_status / draft_reply / none | order_status / draft_reply / none | No extracted ID; email lookup finds order, estimated 2026-11-25. |
| E11 | return_refund / ticket_and_draft | — not run | — not run | return_refund / ticket_and_draft / none | Correct kit/QC policy, but unnecessary non-refundable shipping INR0 wording. |
| E12 | return_refund / ticket_and_draft | return_refund / ticket_and_draft / generic | return_refund / ticket_and_draft / none | return_refund / ticket_and_draft / return_ineligible | Used, eight days, ignore injection; no approved refund. |
| E13 | other / log_only | — not run | — not run | other / log_only / log_only | Unsupported GST request, human review. |
| E14 | complaint / ticket_and_draft | — not run | — not run | complaint / ticket_and_draft / none | Wrong item; High priority, photos and verification. |
| E15 | order_status / draft_reply | — not run | — not run | order_status / draft_reply / none | Correct COD fee49 but omits useful full COD total1897. |
| E16 | return_refund / ticket_and_draft | — not run | — not run | return_refund / ticket_and_draft / return_ineligible | Used, fifteen days; ticket still required. |
| E17 | other / log_only | — not run | — not run | other / log_only / log_only | Internal partnership routing note; no customer reply. |
| E18 | order_status / draft_reply | — not run | — not run | order_status / draft_reply / none | Safe clarification; active-order qualifier is stronger than source lookup. |
| E19 | return_refund / ticket_and_draft | return_refund / ticket_and_draft / generic | return_refund / ticket_and_draft / none | return_refund / ticket_and_draft / return_policy | COD, three days, INR 1648 merchandise, fee excluded; details only after pickup. |
| E20 | product_query / draft_reply | product_query / draft_reply / draft | product_query / draft_reply / medical | product_query / draft_reply / medical | Medical human review, no eczema treatment or timing claim. |
| E21 | complaint / ticket_and_draft | complaint / ticket_and_draft / generic | complaint / ticket_and_draft / none | complaint / ticket_and_draft / none | Reuse E04 ticket, append E21, photos listed not verified, replacement preference. |
| E22 | order_status / draft_reply | — not run | — not run | order_status / draft_reply / order_clarification | KC-1099 absent; never fabricate. |
| E23 | complaint / ticket_and_draft | — not run | — not run | complaint / ticket_and_draft / item_issue | Correct packing-weight/499 remedy, but should explicitly acknowledge refund rather than resend preference. |
| E24 | order_status / draft_reply | order_status / draft_reply / generic | order_status / draft_reply / none | order_status / draft_reply / none | Cancelled, refund INR 828 initiated 2026-11-16; no tracking or completed refund claim. |
| E25 | other / log_only | — not run | — not run | other / log_only / log_only | Thanks, positive, no reply. |

## 3. Summary

| Metric | V1 matched12 | Original V2 matched12 | Final currency matched12 | Final25 split batches |
|---|---|---|---|---|
| Primary correct | 12/12 | 12/12 | 12/12 | 25/25 |
| Secondary exact | 11/12 | 12/12 | 11/12 | 24/25 |
| Reported first-attempt validity | 12/12 | 12/12 | 12/12 | 25/25 |
| Tool-name compliance | 8/12 | 12/12 | 12/12 | 25/25 |
| Generic fallback | 8/12 | 0/12 | 0/12 | 0/25 |
| Escalation correct (declared risk reference) | 10/12 | 12/12 | 12/12 | 25/25 |

## 4. Iteration and limitations

V1 → original V2 improved tool invocation and useful replies. V2.1 added attribution/attachment/date guards and observability. Currency revision retained all core validators and added explicit INR instructions and runner-owned model profile. Model changed3.1→3.5: this is NOT a controlled same-model causal comparison.

Final25 uses two executions (baseline runner44 and extended runner57), not one clean end-to-end25 run. Extended raw audit14/tickets5 contain an earlier E03 smoke record; derived scoring excludes E03 and its ticket, leaving13/4. Raw evidence is untouched. Wrong-tab persistence is disclosed, not fixed.

## 5. Failures and unresolved issues

Historical full regression:88 run,86 pass,2 Finder metadata preservation failures,0 skips. Focused extended tests:5 pass. Frozen assertions/manifests unchanged. Provider503 attempts and safe fallback evidence retained. Additional manual findings appear above. Separate ticket tabs deduplicate only within a batch; derived reconciliation finds nine unique ticket orders but does not prove automatic cross-batch deduplication.

See EVALUATION_REPORT.md for trace checks, persistence reconciliation, latency definitions and manual review. Evaluation links and required screenshots are supplied; recording and access-confirmation actions remain in MANUAL_ACTIONS.md.

## 6. Template completion and metric interpretation

The final Currency + Extended build is the final “v2” required by the template; “Original V2” denotes the earlier archived revision. The 25-row table preserves all compared versions. Its cells list intent / action / fallback kind; they are not blanket semantic pass marks.

| Template summary field | V1 (12) | Final (25) |
|---|---|---|
| Primary intent matches | 12/12 | 25/25 |
| Expected routing action matches | 12/12 | 25/25 |
| First-try valid JSON (reported) | 12/12 | 25/25; independently validated saved raw outputs |
| Human-review flags | 10 | 16 |
| Average tokens/email | Not reliably measured | Not reliably measured |
| Measured cost/email | Not measured | Not measured; hypothetical planning maths in README |

Correct routing does not imply a perfect draft: V1 had eight generic fallbacks; final reservations are E04 (secondary label), E11, E15, E18 and E23. The expected outcomes are evaluator-authored, not official ground truth. No numeric semantic reply-quality score is claimed. Required ticket coverage: V1 6/6 email obligations, final 10/10 obligations mapped to nine tickets. Provider error rate is zero **reported audit errors** in final25, not a claim about unseen internal retries. V1 latencies are unavailable.

### Unresolved failure follow-up

| Case | Issue | Evidence / next step |
|---|---|---|
| E04 | Extra refund secondary vs declared expectation | Review interpretation; do not treat checklist as official gold. |
| E11 / E15 | INR0 phrasing / missing useful COD total | Improve semantic completeness after review. |
| E18 / E23 | Active-order qualifier / refund preference acknowledgement | Tighten grounding and requested-remedy wording. |
| Extended batch | Actual persistence destination differed from intended tabs | Reproduce routing in isolated tabs after authorization; mechanism unproven locally. |
| Historical preservation tests | Two .DS_Store hash failures | Retain failures; separate from functional regressions. |
