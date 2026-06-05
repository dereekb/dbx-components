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

# Validate a component + API folder pair against a model-domain convention
dbx-components-cli validate folder components/demo-firebase apps/demo-api --kind notification
dbx-components-cli validate folder components/demo-firebase apps/demo-api --kind storagefile

# Inventory the model artifacts an app exposes
dbx-components-cli list api components/demo-firebase
dbx-components-cli list models components/demo-firebase --api apps/demo-api
dbx-components-cli list actions apps/demo-api
```

## Commands

| Command | Description |
|---|---|
| `spec tree <specFile> [--api <dir>]` | Parse one spec file into its describe/it/fixture skeleton. |
| `spec search <specFile> <query> [--mode model\|chain\|describe\|it]` | Search a spec tree. |
| `spec list <apiDir>` | Inventory every model-group spec file in an API app. |
| `fixture list <apiDir>` | List the fixture triplets declared by an API app. |
| `fixture lookup <apiDir> <model>` | Inspect one model's fixture triplet + forwarders. |
| `validate folder <componentDir> <apiDir> --kind notification\|storagefile` | Validate a component + API folder pair against a model-domain folder convention. |
| `list api <componentDir> [--model <name>]` | List the CRUD / standalone callModel entries declared in a `-firebase` component. |
| `list models <componentDir> [--api <apiDir>]` | List the Firestore models declared under a `-firebase` component. |
| `list actions <apiDir>` | List the `*ServerActions` classes an API app exposes and how they are wired. |

Every command accepts `--json` for machine-readable output. Validators set a non-zero exit code when they report any error-severity violation, so they pair cleanly with CI gates.
