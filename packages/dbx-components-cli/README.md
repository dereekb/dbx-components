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

# Scaffold a whole dbx-components project (the in-process successor to setup/setup-project.sh)
dbx-components-cli setup init gethapierapp gethapier getHapier 9300 --dir ~/code/gethapier

# Scaffold just one module's template files into an existing project
dbx-components-cli setup api --dir ~/code/gethapier --templates-only

# Preview the full command + file-write plan without touching disk
dbx-components-cli setup init gethapierapp gethapier getHapier 9300 --dir ~/code/gethapier --dry-run

# Validate that the expected dbx-components structure is present
dbx-components-cli setup validate --dir ~/code/gethapier
dbx-components-cli setup validate gethapierapp --module api --dir ~/code/gethapier --json

# Read / derive the dbx.setup.json project manifest
dbx-components-cli setup manifest show --dir ~/code/gethapier
dbx-components-cli setup manifest write gethapierapp gethapier getHapier 9300 --dir ~/code/gethapier

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
| `setup init [firebaseProjectId] …` | Run the full ordered setup sequence (the in-process port of `setup/setup-project.sh`). |
| `setup <module> [firebaseProjectId] …` | Run one module — `workspace`, `firebase-components`, `app-components`, `api`, `app`, `root`, `integrations` — through its generate → install → scaffold → configure phases. |
| `setup validate [--module <id>]` | Validate that the expected scaffolded structure is present (non-zero exit on any missing file). |
| `setup manifest show\|write …` | Read or derive + write the `dbx.setup.json` project manifest. |

Every command accepts `--json` for machine-readable output. Validators set a non-zero exit code when they report any error-severity violation, so they pair cleanly with CI gates.

### `setup` — deterministic project scaffolding

`setup` ports `setup/setup-project.sh` into an in-process, module-by-module CLI. All ~200 template files are bundled inside the package as a `templates.zip` (built by `tools/build-templates-archive.mjs`); each module reads its scaffold subtree from that archive (falling back to the on-disk `templates/` directory for source/dev runs).

- **Modules.** `workspace` (create-nx-workspace + nx.json), `firebase-components`, `app-components`, `api`, `app`, `root` (firebase config, docker, scripts, husky, vitest preset, dependency install, project/tsconfig edits), and `integrations` (zoho scripts + manifest). Each runs four individually-skippable phases — **generate → install → scaffold → configure** (`--skip-generate`, `--skip-install`, `--skip-scaffold`, `--skip-configure`).
- **Naming** is resolved from explicit positionals **or** an existing `dbx.setup.json`, so a single module can be re-run without re-entering it.
- **`--templates-only`** runs only the deterministic scaffold; **`--dry-run`** prints the file-write + shell-command plan without touching disk; **`--ci-test`** installs `@dereekb/*` from the CI dist folder and skips the firebase login + final builds.

The deterministic core (naming derivation, order-sensitive token substitution, the scaffold engine, manifest, json-edits, validation) is fully unit-tested offline; `init`'s generate/install/git phases shell out and are exercised via `--dry-run`.

> **Note:** the templates are duplicated from `setup/templates/**` (plus the scattered repo-root files) into this package's `templates/**`. `setup/setup-project.sh` is intentionally left untouched and keeps working; de-duplicate when the script is retired.
