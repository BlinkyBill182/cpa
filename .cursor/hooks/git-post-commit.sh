#!/usr/bin/env bash
# Runs after every git commit.
# Prints the diff summary to the terminal and copies a review prompt to clipboard.

set -euo pipefail

HASH=$(git log -1 --format="%H")
SHORT=$(git log -1 --format="%h")
MSG=$(git log -1 --format="%s")
DIFF=$(git diff HEAD~1 HEAD --stat 2>/dev/null || git diff --cached --stat 2>/dev/null || echo "(initial commit)")

PROMPT="You are a code review master.
Check the last local changes for commit ${SHORT}: \"${MSG}\"

Please follow codebase conventions, best practice and common usage.

Run: git diff HEAD~1 HEAD

Check each changed file for:
1. TypeScript strict — no \`any\`, no \`@ts-ignore\` without an explanatory comment
2. i18n — no hardcoded UI strings in JSX/actions; all text via dict keys in both en.json and he.json
3. Server actions — Zod validates all FormData before DB access; logAuditEvent() on every state-changing action
4. Session guards — use requireTenantAccessBySlug / requireTenantAdminBySlug (not old cookie-based guards)
5. Supabase env — no top-level process.env; use getPublicSupabaseEnv() / getServerSupabaseEnv()
6. RLS awareness — admin client only where user-scoped client is insufficient
7. CLAUDE.md — if routes, guards, dict namespaces, or action signatures changed, relevant CLAUDE.md was updated

List each violation as a bullet with filename and line. If clean, output: ✓ Looks good."

echo ""
echo "┌─────────────────────────────────────────────────────┐"
echo "│  📋 Code review prompt copied to clipboard          │"
echo "│  Commit: ${SHORT} — ${MSG}"
echo "│  Paste into Cursor to run the review.               │"
echo "└─────────────────────────────────────────────────────┘"
echo ""
echo "Changed files:"
echo "${DIFF}"
echo ""

# Copy to clipboard (macOS pbcopy; falls back to xclip on Linux)
if command -v pbcopy &>/dev/null; then
  printf '%s' "${PROMPT}" | pbcopy
elif command -v xclip &>/dev/null; then
  printf '%s' "${PROMPT}" | xclip -selection clipboard
elif command -v xsel &>/dev/null; then
  printf '%s' "${PROMPT}" | xsel --clipboard --input
fi
