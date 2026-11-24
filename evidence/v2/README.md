# V2 evidence directory

Current checkpoint: V2 authored locally; not imported, deployed or evaluated externally.

The pre-existing STATUS.md is retained unchanged because it is part of the frozen V1 source snapshot; it describes the earlier checkpoint. This README and the V2 docs describe the current checkpoint.

- preservation-before.json: hashes of every pre-existing file at the beginning of V2 work, including the supplied V1 baseline JSON.
- preservation-after.json: final comparison with that manifest and the original frozen V1 snapshot.
- v1-baseline-evaluation.json: derived metrics from genuine supplied V1 results, not a new execution.
- LOCAL_VALIDATION.txt: actual local regression and V2 test output; external boundaries are mocked.
- snapshot.sha256.json: authored V2 source hashes for subsequent integration.

No v2-baseline-results.json or v2-full-results.json has been created because those runs have not happened. Save real outputs here only after authorized external execution. Do not overwrite frozen V1 files or place credentials/private Sheet IDs in public artifacts.
