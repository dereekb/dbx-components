# Token sassdoc convention

`scripts/generate-css-tokens.mjs --source=dbx-web` (and `--source=app` for downstream apps)
parses `///` sassdoc comments adjacent to each `$x-var: --y;` declaration and
turns them into rich entries in the generated token manifest. The manifest
feeds `dbx_css_token_lookup` (forward) and `dbx_ui_smell_check` (reverse).

## Block shape

```scss
/// Hint text color. Use for subtitles and secondary text on default surface.
/// @intent hint text color, secondary text, subtitle text
/// @role text-color
/// @anti-use Don't use --mat-sys-on-surface for hint — use this instead.
/// @utility .dbx-text-hint
/// @see --mat-sys-on-surface
/// @primitive content-box
$dbx-on-surface-variant-color-var: --dbx-on-surface-variant-color;
$dbx-on-surface-variant-color: var($dbx-on-surface-variant-color-var);
```

## Tags

| Tag           | Meaning                                                                                  |
|---------------|------------------------------------------------------------------------------------------|
| `///`         | Plain description line. Multiple unprefixed lines concatenate into one description.      |
| `@intent`     | Comma-separated intent strings. Power the intent matcher.                                |
| `@role`       | One of `color, text-color, surface, spacing, radius, elevation, shadow, typography, motion, state-layer, size, breakpoint, misc`. |
| `@anti-use`   | One-liner that surfaces under "Don't use this when".                                     |
| `@utility`    | Comma-separated dbx utility class selectors (`.dbx-mb3`, `.dbx-text-hint`).              |
| `@see`        | Whitespace-separated css-variable names this token relates to.                           |
| `@primitive`  | dbx-web slug (`content-box`, `section`, `button`) that already wraps this value.         |
| `@light`      | Override for the light-mode default value (otherwise inferred from `_root-variables.scss` / `_config.scss`). |
| `@dark`       | Override for the dark-mode default value.                                                |

Tokens without a sassdoc block still get an entry; `role` is then inferred
from the variable name (`*-color*` → `color`, `*padding*|*margin*|*gap*` → `spacing`,
`*radius*` → `radius`, etc.) and intents from a humanised version of the
variable name.

## Where these tokens come from

- `dereekb-dbx-web` — parsed from `packages/dbx-web/src/lib/style/_variables.scss`
  + `_root-variables.scss` + `_config.scss`.
- `angular-material-m3` — hand-curated in
  `src/manifest/sources/angular-material-m3.tokens.source.json` (Material's
  system token set is stable enough that we revisit only when the framework
  breaks them).
- `angular-material-mdc` — hand-curated in
  `src/manifest/sources/angular-material-mdc.tokens.source.json`. Each entry
  has a `componentScope` (`mat-progress-bar`, `mat-button`, ...) so
  `dbx_css_token_lookup component="..."` returns the relevant overrides.
- `app` — produced from any downstream-app `tokens.scan[]` block in the
  workspace's `dbx-mcp.config.json`.

## Downstream-app config

```jsonc
{
  "tokens": {
    "scan": [
      {
        "project": "apps/hellosubs",
        "source": "hellosubs-app",
        "module": "@hellosubs/app",
        "include": ["apps/hellosubs/src/styles/**/*.scss"],
        "out": "apps/hellosubs/.dbx-mcp/tokens.json"
      }
    ]
  }
}
```

`node packages/dbx-components-mcp/scripts/generate-css-tokens.mjs --source=app
--config=./dbx-mcp.config.json` walks each scan entry, parses the SCSS, and
writes the generated manifest to the configured `out` path. The MCP server
discovers them at startup through `findAndLoadConfig`.
