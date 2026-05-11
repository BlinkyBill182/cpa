#!/usr/bin/env bash
# Runs after every git commit (git hook — fires in any tool: Cursor, Claude Code, terminal).
# 1. Writes a ready-to-paste review prompt to .cursor/last-commit-review.md
# 2. Copies the prompt to clipboard (macOS/Linux)
# 3. Prints a summary to the terminal

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
OUT="${REPO_ROOT}/.cursor/last-commit-review.md"

SHORT=$(git log -1 --format="%h")
MSG=$(git log -1 --format="%s")
DIFF=$(git diff HEAD~1 HEAD --stat 2>/dev/null || echo "(initial commit — no previous commit to diff against)")

PROMPT="# Code Review — ${SHORT}: ${MSG}

> You are a code review master.
> Check the last local changes and follow codebase conventions, best practice and common usage.

Run: \`git diff HEAD~1 HEAD\`

Check each changed file for:

1. **TypeScript strict** — no \`any\`, no \`@ts-ignore\` without an explanatory comment
2. **i18n** — no hardcoded UI strings in JSX/actions; all text via dict keys in both \`en.json\` and \`he.json\`
3. **Server actions** — Zod validates all FormData before DB access; \`logAuditEvent()\` on every state-changing action
4. **Session guards** — use \`requireTenantAccessBySlug\` / \`requireTenantAdminBySlug\` (not old cookie-based guards)
5. **Supabase env** — no top-level \`process.env\`; use \`getPublicSupabaseEnv()\` / \`getServerSupabaseEnv()\`
6. **RLS awareness** — admin client only where user-scoped client is insufficient
7. **CLAUDE.md** — if routes, guards, dict namespaces, or action signatures changed, relevant \`CLAUDE.md\` was updated

List each violation as a bullet with filename and line. If clean, output: ✓ Looks good.

---

## Changed files in this commit

\`\`\`
${DIFF}
\`\`\`
"

# Write to file (visible in any tool — Cursor, Claude Code, file browser)
printf '%s' "${PROMPT}" > "${OUT}"

# Copy to clipboard (macOS pbcopy; falls back to xclip / xsel on Linux)
if command -v pbcopy &>/dev/null; then
  printf '%s' "${PROMPT}" | pbcopy
elif command -v xclip &>/dev/null; then
  printf '%s' "${PROMPT}" | xclip -selection clipboard
elif command -v xsel &>/dev/null; then
  printf '%s' "${PROMPT}" | xsel --clipboard --input
fi

echo ""
echo "┌──────────────────────────────────────────────────────────────┐"
echo "│  ✅ Post-commit review ready                                 │"
echo "│  Commit : ${SHORT} — ${MSG}"
echo "│  File   : .cursor/last-commit-review.md                     │"
echo "│  Paste  : prompt copied to clipboard — Cmd+V into Cursor    │"
echo "└──────────────────────────────────────────────────────────────┘"
echo ""
echo "Changed files:"
echo "${DIFF}"
echo ""
