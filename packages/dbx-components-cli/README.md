# @dereekb/dbx-components-cli

The distributed command-line sibling of [`@dereekb/dbx-components-mcp`](../dbx-components-mcp). It exposes the dbx-components workspace scanners as terminal commands so they can run in scripts and CI without an MCP/agent round-trip.

The scanner logic itself lives in `@dereekb/dbx-cli` (e.g. `@dereekb/dbx-cli/model-test`); this package is the thin yargs presentation layer over it — the same logic the MCP server wraps as tools.

## Usage

```bash
# Parse one spec file into its describe/it/fixture skeleton
dbx-components-cli spec tree apps/demo-api/src/app/function/guestbook/guestbook.crud.spec.ts --api apps/demo-api

# Search a spec tree (by model / chain / describe / it)
dbx-components-cli spec search apps/demo-api/.../guestbook.crud.spec.ts Guestbook --mode model

# Inventory every model-group spec file in an API app
dbx-components-cli spec list apps/demo-api

# List the fixture triplets declared by an API app
dbx-components-cli fixture list apps/demo-api

# Inspect one model's fixture triplet + forwarders
dbx-components-cli fixture lookup apps/demo-api Guestbook
```

Every command accepts `--json` for machine-readable output and exits non-zero on error, so it pairs cleanly with CI gates.
