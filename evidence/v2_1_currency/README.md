# Currency/config revision evidence

This directory contains local derived review/validation, not a new external run.

- preservation-before.json: SHA-256 of all 119 files present before this revision.
- snapshots/v2_1-before-currency/: byte-for-byte copies of 33 V2.1 source/config/prompt/workflow/test/doc/evidence files, including all four supplied smoke executions.
- v2_1-snapshot-before-currency.sha256.json: archive hash manifest. Original V2.1 snapshot and raw files remain unchanged in their original locations.
- smoke-evidence-review.json: derived provider/model/fallback/timing review of saved executions34/35,36/37,38/39,40/41; no external requests.
- node-changes.json: exact parameter diff; unchanged 50/9-node graphs.
- verification-final.json: phase preservation, original/frozen snapshot verification and export hashes.
- LOCAL_VALIDATION_FINAL.tap / test-results-final.json: final actual unfiltered test results.88 run,86 passed, two historical metadata assertion failures; none skipped. Earlier local test records are retained.
- snapshot-final.sha256.json: hashes for new deliverables after final validation; not a replacement for any historical manifest.

The successful historical smoke uses3.5 rather than the V1/V2 reference3.1 and is not a controlled same-model comparison. It used a return-policy fallback, not a successful repaired agent draft. A new currency-revision smoke/baseline/full run has not occurred. Do not create measured-result files until actual authorized execution.
