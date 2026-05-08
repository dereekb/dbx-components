# Zoho Integration Setup Script

Generates the NestJS modules, services, and env-var stubs needed to wire `@dereekb/zoho/nestjs` (Recruit / CRM / Sign) into a dbx-components-derived app.

The script reads `dbx.setup.json` (written by `setup-project.sh` at the project root) for the project's app prefix, api app name, and firebase components package — so you don't have to pass them in.

## Usage (in a downstream project)

After `setup-project.sh` has run, this folder lives at `<project>/scripts/zoho/`. From the project root:

```bash
# Interactive — prompts for which products to wire up
node scripts/zoho/setup-zoho.mjs

# Non-interactive
node scripts/zoho/setup-zoho.mjs --products=recruit,crm,sign --yes
```

Supported products: `recruit`, `crm`, `sign`.

The script will:

1. Generate files under `apps/<api-app>/src/app/api/zoho/`:
   - `zoho.module.ts` — dependency module (3-tier OAuth token cache: memory → file → Firestore) + per-product modules + aggregate module
   - `zoho.service.ts` — facade injecting the selected product APIs
   - `zoho.<product>.service.ts` — per-product domain service shell (one per selected product)
   - `zoho.sign.webhook.module.ts` — only if Sign is selected
2. Patch `apps/<api-app>/src/app/api/api.module.ts` — add the aggregate module (and Sign webhook module) to its `imports` array
3. Append `ZOHO_*` env-var stubs to `.env`, `.env.staging`, `.env.prod` (idempotent — skipped if `ZOHO_ACCOUNTS_URL=` is already present)

After running, fill in the OAuth credentials in your `.env` files and run `pnpm nx build <api-app>` to verify the generated code compiles.

## Re-running

The script refuses to overwrite existing files. To re-run with a different product set, delete the `apps/<api-app>/src/app/api/zoho/` folder first.

## File layout

```
scripts/
├── _lib/
│   └── setup-config.mjs           # shared manifest reader (dbx.setup.json + prefix variant deriver)
└── zoho/
    ├── setup-zoho.mjs             # this script
    └── templates/                 # .tmpl files rendered via token substitution + //#if blocks
        ├── zoho.module.ts.tmpl
        ├── zoho.service.ts.tmpl
        ├── zoho.recruit.service.ts.tmpl
        ├── zoho.crm.service.ts.tmpl
        ├── zoho.sign.service.ts.tmpl
        ├── zoho.sign.webhook.module.ts.tmpl
        └── env.tmpl
```

## How template rendering works

`.tmpl` files are TypeScript with two preprocessor conventions:

- **Tokens** — replaced by string substitution:
  - `__APP_PASCAL__` → e.g. `MyApp`
  - `__APP_CAMEL__` → e.g. `myApp`
  - `__FIREBASE_COMPONENTS__` → e.g. `myapp-firebase` (from `dbx.setup.json` → `components.firebase`)
- **Conditional blocks** — `//#if <product>` … `//#endif`. Lines inside the block are kept only if `<product>` is in the selected set; the marker lines themselves are stripped. Use this for product-specific imports / providers / env vars.

## Editing this folder upstream (in the dbx-components repo)

Source of truth lives at `setup/templates/scripts/zoho/` in the dbx-components repo. Files are copied into a new project by `setup-project.sh` via `curl` — there is no bulk `cp -R`, so any **new** file you add to this folder must also be added to the curl loop in `setup/setup-project.sh`. The relevant block looks like:

```bash
for tmpl in zoho.module.ts.tmpl zoho.service.ts.tmpl ... env.tmpl; do
  curl -sSf "$SCRIPTS_BASE/zoho/templates/$tmpl" -o "scripts/zoho/templates/$tmpl"
done
```

Add the new filename to that list. The same applies to any new `.mjs` files alongside `setup-zoho.mjs`.

## Adding a new integration script (OIDC, Stripe, etc.)

1. Create a sibling folder `setup/templates/scripts/<integration>/` with its own `setup-<integration>.mjs` and (optionally) `templates/`.
2. Import the shared helper: `import { readDbxSetup } from '../_lib/setup-config.mjs';`
3. Add a curl block in `setup/setup-project.sh` to copy your new files into the new project.
4. Add a bullet in `setup/setup-project-readme.md` under "Per-integration Setup Scripts".
