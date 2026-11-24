# GitHub upload plan — approval required

Nothing has been staged, committed, cloned remotely or pushed during finalization. Upload the **contents of this submission directory at repository root**, not the entire assignment checkout. Do not carry over the assignment checkout's .git history or implementation/ tree. Git author identity is separate from credentials; use a GitHub noreply address if privacy is desired.

After explicit approval:

```sh
# Run from the existing submission directory.
SUBMISSION_SOURCE="$PWD"
PUBLISH_DIR="$(mktemp -d /tmp/kesar-public-upload.XXXXXX)"
git clone https://github.com/jainnirdesh/kesar-ai-copilot.git "$PUBLISH_DIR/repository"
git -C "$PUBLISH_DIR/repository" status --short
git -C "$PUBLISH_DIR/repository" ls-tree -r --name-only HEAD
```

Inspect any existing remote files, license and history first. An empty repository may have no HEAD. Stop for conflicts, unexpected existing content or a blanket license covering company materials; do not force-push, silently delete remote files or apply MIT licensing. This remote inspection has not happened yet.

Once the remote tree is confirmed compatible:

```sh
rsync -a --exclude='.git/' --exclude='.DS_Store' --exclude='._*' --exclude='__pycache__/' "$SUBMISSION_SOURCE/" "$PUBLISH_DIR/repository/"
git -C "$PUBLISH_DIR/repository" add --all
git -C "$PUBLISH_DIR/repository" diff --cached --stat
git -C "$PUBLISH_DIR/repository" diff --cached --check
```

Review the full staged file list and the local final-public-check.json/MANIFEST.sha256.json; ensure only intended submission files and already-approved remote content are staged. Verify manifest hashes before committing. Then, only under the explicit upload approval:

```sh
git -C "$PUBLISH_DIR/repository" commit -m "Add Kesar AI Copilot assignment submission"
git -C "$PUBLISH_DIR/repository" push -u origin HEAD
```

No force push. If the remote changes or lacks a suitable branch, stop and reconcile before pushing. Check rendered README, image links and reviewer Sheet access afterward. The five-minute recording remains an outstanding official requirement, even if code upload is approved separately.
