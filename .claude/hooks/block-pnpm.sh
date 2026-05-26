#!/usr/bin/env bash
# PreToolUse Bash hook: block `pnpm` invocations.
# This project migrated from pnpm to npm + nx — pnpm-lock.yaml has been removed.
# Exits 2 with stderr message so Claude is blocked and sees the reason.

set -u

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')

# Word-boundary match: pad with spaces so the boundary character class catches
# pnpm at start, middle, or end without relying on (^|...) alternation
# (BSD/ugrep handle alternation inconsistently here).
# Catches `pnpm install`, `cd x && pnpm nx ...`. Skips `mypnpm` / `pnpmx` / `$pnpm_var`.
padded=" ${command} "
if printf '%s' "$padded" | grep -Eq '[^A-Za-z0-9_-]pnpm[^A-Za-z0-9_-]'; then
  cat >&2 <<'EOF'
[block-pnpm] This workspace no longer uses pnpm. Use one of:

  - Run Nx tasks:      npm exec nx <target> <project>
                       (e.g. `npm exec nx build demo-api`, `npm exec nx test @dereekb/util`)
  - Install deps:      npm install
  - Add a package:     npm add <pkg>           (or `npm install <pkg>`)
  - Remove a package:  npm uninstall <pkg>
  - Run a workspace script: npm run <script>

The pnpm-lock.yaml has been removed in favor of package-lock.json. Do not reintroduce pnpm.
EOF
  exit 2
fi

exit 0
