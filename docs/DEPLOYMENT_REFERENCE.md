# Exact future n8n update instructions — do not execute yet

These instructions are prepared for a later explicit authorization. No step was performed on Cloud or Sheets during this local revision. Preserve runner40/processor41 and the failed-run evidence; do not clear their data to test a new prompt.

## Recommended: import the revision as two new workflows

1. Import `implementation/workflow/v2_1_currency/01-kesar-v2.1-currency-processor.json` into a NEW workflow. Save its name **Kesar V2.1 - Single Email Processor (currency-config)**.
2. Import `implementation/workflow/v2_1_currency/02-kesar-v2.1-currency-runner.json` into a NEW workflow. Save as **Kesar V2.1 - Serial Manual Test Runner (currency-config)**.
3. Runner → **Execute V2.1 processor**: select the NEW currency-config processor. Retain Run once with all items and Wait for Sub-Workflow Completion=true. Processor input remains Accept all data. Restrict allowed callers to the revision runner where supported.
4. Bind Gemini credentials on processor **Classification Gemini** and **Drafting Gemini**. Keep each model field as the existing expression `{{ $('Initialize').first().json.config.model }}`. **Do not replace it with a manually selected literal model.** The same Drafting Gemini serves initial and repair agents.
5. Bind Google Sheets OAuth2 on processor **Read audit**, **Read tickets**, **Write ticket RAW**, **Write audit RAW**, and runner **Read target tabs** (five HTTP nodes). No keys/tokens in code, URLs or chat.
6. Record Help → About n8n version. Set it in the runner configuration; supplied evidence still has a placeholder.

## Configure the runner only

In **Runner configuration**, the selected `settings` object is near the end of the Code node, after helper definitions. Set the private spreadsheet ID there. Do not add a configuration object back to processor Initialize.

Keep:

```json
{
  "profile_revision": "v2.1-currency-1",
  "model": "models/gemini-3.5-flash-lite",
  "baseline_model": "models/gemini-3.5-flash-lite",
  "v1_model_confirmed": false,
  "confidence_threshold": 0.85,
  "delay_seconds": 15,
  "run_mode": "smoke"
}
```

Keep the remaining example fields and exact isolated tab names. Local examples are not automatically loaded by Cloud. The child-workflow selector is authoritative; the example processor_workflow_id does not bind it automatically.

Processor Initialize has **no selected-model object**. It consumes runtime_profile from the runner and validates the handshake, model allowlist, baseline pin, comparison flag, Sheet target and tab names before any API work. A legacy runner lacks this profile and is rejected. Do not remove these checks or copy the old manual smoke-only guard back into the revision.

## Prepare new tabs without changing existing data

Use a new spreadsheet, or add NEW uniquely named tabs, only after authorization:

| New tab | Exact unchanged template |
|---|---|
| V2.1 Currency Smoke Audit Log | implementation/sheets/audit_log_template.csv |
| V2.1 Currency Smoke Tickets | implementation/sheets/tickets_template.csv |
| V2.1 Currency Baseline Audit Log | implementation/sheets/audit_log_template.csv |
| V2.1 Currency Baseline Tickets | implementation/sheets/tickets_template.csv |

Import each CSV as a new sheet and rename exactly. Retain all original columns/order. Both baseline tabs must contain headers only. Do not copy or delete V1/V2/V2.1 records. New smoke tabs avoid an E03 replay of the already successful old smoke row.

For a later authorized smoke, keep mode=smoke and smoke_ids=["E03"]. Inspect both raw bodies: the goal is a source-correct INR-prefixed fee without a fallback, not just persisted status. If repair is needed, inspect monetary_correction.required_phrase and actual tool observations. Repeated omission must still be rejected and safely fall back.

## Exact changed-node map, if applying an audited patch instead

Full new-workflow import is recommended because both ends of the profile protocol must change together. `evidence/v2_1_currency/node-changes.json` gives the precise parameter diff; the export supplies the complete replacement field values. No node connection graph changed.

Processor:

| Node | Replace these parameters from the new processor export |
|---|---|
| Initialize | jsCode — removes duplicate model selection; consumes validated runner profile |
| Tool requirement planning | jsCode — adds authorized formatted monetary_context |
| Semantic validation | jsCode — adds exact source-derived monetary_correction |
| Drafting Agent | text and options.systemMessage — currency context/instructions; preserve all other options |
| Targeted Repair Agent | text and options.systemMessage — explicit correction payload/instructions |
| Plan audit | jsCode — revision prompt_version label; original validators unchanged |
| Result | jsCode — revision label and inherited effective-model observability |
| Replay result | jsCode — revision label |

Runner:

| Node | Replacement |
|---|---|
| Runner configuration | jsCode — sole selected-model/Sheet settings and profile validation |
| Select official emails | jsCode — forwards the profile and handshake metadata |
| Execute V2.1 processor | workflowId — new processor |
| Completed results | jsCode — checks returned revision/model and declares comparison provenance |

Do not patch just the two Gemini model dropdowns or only one workflow. Export the currently deployed versions privately before any future update; this workspace snapshot preserves local V2.1 plus supplied execution evidence, not an unsupplied Cloud export. Review all configured exports for keys, credential references, private Sheet IDs and sensitive metadata before publishing.

## Baseline-ready but not executed

`config/v2_1_currency/baseline-ready.example.json` pins 3.5 and mode=baseline. To use it later, change runner settings.run_mode to baseline after a revised smoke passes, retaining model=baseline_model and false v1_model_confirmed. No processor edit is needed. Empty-tab preflight must pass and all 12 results must be newly persisted. Full mode is disabled.

Never run two runners against the same Sheet. A partial baseline must be retained as incomplete; do not delete evidence to force a fresh-run claim. Import compatibility and actual revised-model behavior remain unverified until authorized integration.
