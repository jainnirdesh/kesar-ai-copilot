# Extended 13-email deployment checkpoint

Separate copies of the existing currency-config exports. No previous exports, prompts, model settings, core policy/safety/monetary logic or evidence were edited. Only mode/profile guards, tab allowlists, freshness/replay checks, handshake scope and selection/completion logic changed. Node topology remains unchanged. No external execution occurred.

Mode: `extended`. Run ID: `v2.1-currency-extended`.
Emails: E05,E06,E09,E11,E13,E14,E15,E16,E17,E18,E22,E23,E25.

## Exact future deployment steps

1. Import `implementation/workflow/v2_1_currency_extended/01-kesar-v2.1-currency-extended-processor.json` as a NEW workflow, then import `02-kesar-v2.1-currency-extended-runner.json` as another NEW workflow. Preserve previous workflows and their data.
2. Runner → **Execute V2.1 processor**: select the NEW extended processor. Keep Wait for Sub-Workflow Completion=true and Run once with all items. Processor trigger remains Accept all data.
3. Bind Gemini credentials to processor **Classification Gemini** and **Drafting Gemini**. Keep their model expressions unchanged. Bind Sheets OAuth to processor **Read audit**, **Read tickets**, **Write ticket RAW**, **Write audit RAW**, plus runner **Read target tabs**.
4. When Sheet setup is authorized, create two NEW header-only tabs: **V2.1 Currency Extended Audit Log** and **V2.1 Currency Extended Tickets**. Import unchanged `implementation/sheets/audit_log_template.csv` and `tickets_template.csv` respectively. Do not copy baseline/smoke rows.
5. In runner **Runner configuration**, set only the private `settings.sheet_id` and actual `n8n_version`. Defaults already select mode=extended, model=baseline_model=models/gemini-3.5-flash-lite, v1_model_confirmed=false, threshold0.85, delay15 and the required Extended tab names. Do not add configuration to processor Initialize.
6. Save. Do not execute until authorized. Preflight requires both Extended tabs empty; the completion guard requires 13 distinct newly persisted results. Legacy baseline/smoke runners are incompatible with this extended-only processor.

## Deduplication scope

Ticket lookup/deduplication reads **Extended Tickets only**. It does not search baseline or smoke ticket tabs. Therefore cross-batch same-order tickets would not automatically merge. Before claiming globally deduplicated coverage across all25 emails, reconcile order IDs and ticket histories across saved batch exports. Do not copy old ticket rows into the empty Extended evaluation tabs. Processing is still serial; concurrent writers are unsupported.

## Local verification

Five focused tests passed, zero failed: exact selection/profile, matching handshake, empty-tab/replay/completion guards, unchanged prompts/model/core/topology, and preservation of prior non-metadata files. See `test-results.txt`; old full suites were deliberately not rerun. Historical .DS_Store issues remain untouched.

Reproduce only the focused checks: `node --test implementation/extended/test_extended.js`.
