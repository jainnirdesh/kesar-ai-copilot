# Reproduce the provided automation

Accounts: n8n Cloud, Gemini API, Google Sheets OAuth. Credentials belong only in n8n credentials manager. Use only fictional provided data; no mail sending or operational refunds.

1. Import workflow/v2_1_currency/01-kesar-v2.1-currency-processor.json first, then02-kesar-v2.1-currency-runner.json as NEW workflows. Bind runner Execute V2.1 processor to the new currency processor; retain waited single-item execution and Accept all data trigger.
2. Bind Gemini credentials to Classification Gemini and Drafting Gemini. Keep model expressions reading Initialize.config.model. Bind Sheets OAuth to processor Read audit, Read tickets, Write ticket RAW, Write audit RAW and runner Read target tabs.
3. Runner configuration is the only selected-model/Sheet configuration. Set private sheet_id and actual n8n_version. Keep model=baseline_model=models/gemini-3.5-flash-lite, v1_model_confirmed=false, threshold0.85, delay15 and default smoke mode. Processor validates the runner profile; do not add a duplicate selected model to Initialize.
4. For a future separately authorized rerun, import exact templates into NEW Currency Smoke/Baseline Audit Log/Tickets tabs using names in runner settings. Baseline mode requires empty header-only tabs and12 new IDs. Existing saved runs are already supplied; no rerun is required merely to inspect this submission.
5. To reproduce the remaining13, import workflow/v2_1_currency_extended/01...processor.json then02...runner.json and select that extended processor. Bind the same two Gemini/five Sheets credentials. Runner defaults extended mode, the13 IDs, v2.1-currency-extended run ID and V2.1 Currency Extended Audit Log/Tickets. Use header-only NEW tabs. The reused Check baseline freshness node now checks extended tabs. Do not mix runner/processor versions.
6. Export actual result JSON and both CSVs. Keep smoke, baseline and extended evidence separate. Existing extended CSVs contain an E03 smoke record due to wrong-tab persistence; that problem is disclosed, not corrected in historical files or claimed fixed in the deployed environment.

Prompt version remains v2.1-currency-1 across the two final batches. The separate modes/run IDs identify execution scope. Deduplication is local to each ticket tab; reconcile cross-batch order IDs before combining results. Full25 mode is disabled in these exports; existing evidence covers25 in separate12+13 executions.

Older workflow/v1 and workflow/v2 exports are included for inspection/comparison. Their integration instructions are historical, not instructions to overwrite final workflows. Record account n8n version; compatibility must be checked on import. A single runner at a time is required.

Offline evaluation from submission root: python3 code/evaluate_submission.py. It reads copied raw evidence and regenerates derived metrics/CSVs/TEST_REPORT only; it does not call APIs. Source code/core.js is dependency-free. Raw and derived evidence directories are clearly separated. Full execution/trace validation already recorded in evidence/derived/trace-validation.json.

## Exact final configuration reference (future authorized reproduction only)

For each matched pair, import the **01 processor first**, then the **02 runner**. In the runner `Runner configuration` Code node, edit only the trailing `settings` object. Set `sheet_id`, `processor_workflow_id` and actual `n8n_version`; select the same processor in `Execute V2.1 processor`, retain `waitForSubWorkflow: true`. Bind Google Sheets OAuth on processor `Read audit`, `Read tickets`, `Write ticket RAW`, `Write audit RAW` and runner `Read target tabs`. Bind Gemini credentials on `Classification Gemini` and `Drafting Gemini`. Keep dynamic model expressions; processor `Initialize` consumes the runner profile.

| Setting | Currency baseline pair | Extended pair |
|---|---|---|
| `model`, `baseline_model` | `models/gemini-3.5-flash-lite` | same |
| `profile_revision`, `prompt_version` | `v2.1-currency-1` | same |
| `v1_model_confirmed` | `false` | `false` |
| `confidence_threshold` / `delay_seconds` | `0.85` / `15` | same |
| `run_mode` for fresh evaluation | `baseline` (export defaults to `smoke`) | `extended` |
| `run_id` | `v2.1-currency-baseline` (change smoke default) | `v2.1-currency-extended` |
| `audit_tab` | `V2.1 Currency Baseline Audit Log` | `V2.1 Currency Extended Audit Log` |
| `tickets_tab` | `V2.1 Currency Baseline Tickets` | `V2.1 Currency Extended Tickets` |

For smoke mode retain `v2.1-currency-smoke`, `smoke_ids: ["E03"]` and the exact Currency Smoke tab names. Baseline uses the saved 12 selected IDs; extended uses the remaining 13. Headers are in `templates/audit_log_template.csv` and `templates/tickets_template.csv`. Freshness guards require header-only target tabs; do not clear existing evaluation tabs. When existing exact tab names already hold data, use a **new spreadsheet** with the allowlisted names. Run only one runner at a time. Inspect intended versus actual persistence tabs in the deployed node expressions before authorizing execution: extended historical wrong-tab persistence remains unresolved.

All ten archived exports are in README's directory table; V2.1/V1/V2 are historical inspection artifacts, not final selected versions. No revised workflow was imported by this packaging task. The local evaluation script regenerates derived reports, including TEST_REPORT; it is supplied for reproducibility and was not rerun here. Back up finalized narrative additions before any later regeneration.
