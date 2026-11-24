# Public-copy sanitization

Personal absolute filesystem prefixes were replaced with `[LOCAL_WORKSPACE]` / `[LOCAL_HOME]` in three copied historical TAP logs. These public copies intentionally differ from their originals only in path text. No original raw evidence under `implementation/evidence/` was changed. Test outcomes and the historical .DS_Store failures remain visible; no assertions, historical manifests or measured metrics were changed.

`evidence/derived/sanitization.json` records each public file, its pre-sanitization/original-source SHA-256 and its sanitized SHA-256. Earlier package-validation.json remains a historical pre-sanitization check; its byte-identical-copy statement applies to that checkpoint. Current packaged hashes are in MANIFEST.sha256.json.

Live n8n editor placeholders were removed from README. Importable JSON exports and authentic execution screenshots provide workflow access and evidence. Required Sheet links and three final screenshots are now supplied; sharing permissions are unverified and the recording remains missing.
