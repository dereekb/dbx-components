# Slim @dereekb/dbx-components-mcp manifests — drop sourcePath / sourceLocation

## Goal

Remove `sourcePath` and `sourceLocation` (and similar source-anchor fields) from every cluster's manifest schema, build pipeline, formatter output, and test fixtures in `packages/dbx-components-mcp`. These fields reference paths that downstream consumers of `@dereekb/dbx-components-mcp` cannot resolve — the consumer has the package as compiled npm output, not as source. The fields also bloat the bundled manifests (the package ships ~470KB of generated JSON across 11 manifests, of which a meaningful fraction is `sourcePath`/`sourceLocation` strings repeated on every entry).

The `dbx-docs-ui-examples` cluster has already been done in a prior change — see `~/.claude/cloud-sync/log/dbcomponents/slim-dbx-docs-ui-examples-manifest.md`. Use that change as a template for the per-cluster surgery.

## Scope

In-scope clusters (each has its own schema/build/formatter/spec triplet):

| cluster | schema | build-manifest | extract | formatter / tool | specs |
|---|---|---|---|---|---|
| ui-components | `manifest/ui-components-schema.ts` | `scan/ui-components-build-manifest.ts` | `scan/ui-components-extract.ts` | `tools/lookup-ui.tool.ts` (line 170: `**source:**`) | `tools/lookup-ui.tool.spec.ts`, `tools/search-ui.tool.spec.ts`, `manifest/ui-components-loader.spec.ts`, `scan/ui-components-build-manifest.spec.ts` |
| actions | `manifest/actions-schema.ts` | `scan/actions-build-manifest.ts` | `scan/actions-extract.ts` | (check `tools/lookup-action.tool.ts` if it emits `sourcePath` — it does not currently per spec fixtures) | `tools/lookup-action.tool.spec.ts` |
| pipes | `manifest/pipes-schema.ts` | `scan/pipes-build-manifest.ts` | `scan/pipes-extract.ts` | (check `tools/lookup-pipe.tool.ts`) | `tools/lookup-pipe.tool.spec.ts` |
| filters | `manifest/filters-schema.ts` | `scan/filters-build-manifest.ts` | `scan/filters-extract.ts` | (check `tools/lookup-filter.tool.ts`) | `tools/lookup-filter.tool.spec.ts` |
| forge-fields | `manifest/forge-fields-schema.ts` | `scan/forge-fields-build-manifest.ts` | `scan/forge-fields-extract.ts` | `tools/form-lookup.formatter.ts` (line 45: `**source:**`) | `tools/lookup-form.tool.spec.ts` |
| semantic-types | `manifest/semantic-types-schema.ts` | `scan/build-manifest.ts` (shared) | (shared extract) | `tools/semantic-type-lookup.formatter.ts` (lines 96–97: `### Source` block) | `tools/lookup-semantic-type.tool.spec.ts`, `manifest/semantic-types-schema.spec.ts`, `scan/build-manifest.spec.ts` |
| tokens | `manifest/tokens-schema.ts` | (verify) | (verify) | (verify) | (verify) |

Out of scope: the `_validate` / `*-validate-app` / `*-validate-folder` extract pipelines — those use `sourcePath` for in-process AST inspection and never persist it.

## Reference: dbx-docs-ui-examples diff (already done)

Use this as the template for each cluster. The per-cluster surgery is the same pattern.

- **Schema** (`manifest/dbx-docs-ui-examples-schema.ts`): dropped `sourcePath` and `sourceLocation` from both the per-entry type and the per-use sub-type. Bumped the JSDoc to explain why (downstream consumers can't resolve them).
- **Build manifest** (`scan/dbx-docs-ui-examples-build-manifest.ts`): `assembleEntry` no longer emits the dropped fields; removed unused `relative` import.
- **Extract** (`scan/dbx-docs-ui-examples-extract.ts`): `resolveUseEntry` no longer captures `sourcePath`/`sourceLocation`; the runtime arktype validator (`ExtractedDbxDocsUiExampleEntrySchema`) was synced.
- **Formatter** (`tools/ui-examples.tool.ts`): no longer renders the per-use `## Source` block (none existed for use entries here, but the analogous `**source:**` lines must come out in other clusters). Also dropped the entire `## Component` wrapper block in this cluster (unrelated cleanup).

## Per-cluster surgery — recipe

For each cluster row in the table above, apply this 5-step recipe:

### 1. Schema — drop the fields

Open `manifest/<cluster>-schema.ts`. The entry type is the `type({...})` call near the bottom (e.g. `UiComponentEntry`, `ActionEntry`, etc.). Remove these properties:

```ts
sourcePath: 'string',
'sourceLocation?': type({ file: 'string', line: 'number' })
```

(Some clusters mark `sourcePath` required, others optional. Some have only `sourcePath`, some have only `sourceLocation`. Drop whichever is present.) If the file's header docstring calls these fields out, update that prose too. Keep the `module`/`source`/`generatedAt`/`generator` envelope fields — they are lightweight provenance and consumers don't see them in tool output.

### 2. Build-manifest — stop emitting

Open `scan/<cluster>-build-manifest.ts`. Find the assembly function (often `assembleEntry` or inlined in a `.map()` over extracted entries) and remove the `sourcePath` / `sourceLocation` keys from the returned object. Remove the `relative()` / `path` imports if they become unused (the dbx-docs-ui-examples version dropped `relative`).

### 3. Extract — stop capturing

Open `scan/<cluster>-extract.ts`. The extracted-entry interface (e.g. `ExtractedUiComponentEntry`, `ExtractedActionEntry`) typically mirrors the schema but with `filePath` + `line` for in-process warning use. Drop `sourcePath` / `sourceLocation` from the returned objects in the extract code (search for `sourcePath:` and `sourceLocation:` in the file). Keep `filePath` + `line` so extract warnings still point a developer back to the originating file — those are internal-only and never persisted.

If the extract file exports a runtime arktype validator that mirrors the persisted schema (e.g. `ExtractedDbxDocsUiExampleEntrySchema`), sync that too.

### 4. Formatter — stop rendering

Open the listed formatter file(s) for the cluster:

- `tools/lookup-ui.tool.ts:170` — remove `` `- **source:** \`${entry.sourcePath}\`` `` from the line array.
- `tools/form-lookup.formatter.ts:45` — remove the `**source:**` segment.
- `tools/semantic-type-lookup.formatter.ts:96–97` — remove the entire `### Source` block.

For other clusters, search the `tools/lookup-<cluster>.tool.ts` (or its formatter) for the pattern `\`${entry.sourcePath}\`` or `entry.sourceLocation`. There may be none — in which case nothing to change here.

### 5. Specs — drop fixture fields

Each cluster's `tools/lookup-<cluster>.tool.spec.ts` (and search/loader/build spec) hand-writes fixtures that include `sourcePath:` and/or `sourceLocation: { file, line }`. Remove those keys from every fixture object. Also remove any `expect(text).toMatch(/source:/)`-style assertions that verify the formatter output.

After the change, the spec arktype validations (where used) should still pass because the schema no longer requires the dropped fields.

## Registry-runtime files

Each cluster has a `registry/<cluster>-runtime.ts` that builds the lookup index. Most do **not** read `sourcePath`/`sourceLocation` at all — they only consume `slug`, `category`, `module`, `relatedSlugs`. Verify each registry file by grepping for `sourcePath` / `sourceLocation`; if found, the reference is almost certainly inside an internal type alias mirror and can be deleted along with the schema field. (The earlier audit listed `actions-runtime`, `filters-runtime`, `forge-fields`, `form-fields`, `pipes-runtime` as having matches — confirm and trim.)

## Regeneration

After all schemas/builds/formatters are updated:

```bash
pnpm nx build dbx-components-mcp
```

This runs the manifest generators that write into `packages/dbx-components-mcp/generated/`. The new manifests should be visibly smaller. Compare sizes with `wc -c packages/dbx-components-mcp/generated/*.json` before and after — expect roughly a 10–20% reduction across the @dereekb/* manifests.

## Test commands

```bash
# Full package test suite
pnpm nx test dbx-components-mcp --reporter=agent

# Targeted while iterating (use --testFile, NOT --testPathPattern; this workspace is Vitest):
pnpm nx test dbx-components-mcp --testFile=src/tools/lookup-ui.tool.spec.ts --reporter=agent
pnpm nx test dbx-components-mcp --testFile=src/manifest/ui-components-loader.spec.ts --reporter=agent
```

The pre-existing test count is 865 across 84 files — the post-change count must match or exceed that. Any drop indicates a removed test that should not have been removed.

## Backwards compatibility

Arktype's default object validation is permissive: extra keys pass through and are ignored. So:
- Old manifests built by previous generator versions still load fine — the dropped fields linger as untyped extras in the runtime entry, but no formatter reads them anymore, so there's no visible regression.
- This is **not** a manifest version bump. The schema `version: 1` is preserved.

If a stricter validation is desired later, bump the schema to `version: 2` and use a stricter arktype mode. Out of scope for this change.

## Validation checklist

Before declaring done:

- [ ] `pnpm nx build dbx-components-mcp` succeeds.
- [ ] `pnpm nx test dbx-components-mcp --reporter=agent` reports ≥ 865 tests passing.
- [ ] `grep -rn "sourcePath\|sourceLocation" packages/dbx-components-mcp/src --include="*.ts"` returns only matches inside `_validate` / `*-validate-app` files (the in-process AST tools that intentionally retain these).
- [ ] `grep -c "sourcePath\|sourceLocation" packages/dbx-components-mcp/generated/*.json` returns 0 across every generated manifest.
- [ ] The dist file at `dist/packages/dbx-components-mcp/dbx-components-mcp.js` has been rebuilt (check mtime).
- [ ] Sanity-check one tool response by running the MCP locally (or in a fresh Claude Code session) and confirming no `**source:**` / `### Source` lines appear in `dbx_ui_lookup`, `dbx_form_lookup`, or `dbx_semantic_type_lookup`.

## Notes for the executing agent

- Auto mode is on; proceed without per-cluster confirmation, but run tests after each cluster so any breakage is localized.
- The MCP server currently running in the user's Claude Code sessions has the older bundle in memory. The new behavior takes effect after the MCP child process restarts (not just the rebuild). Don't try to verify behavior change by re-calling the live tool — verify by reading the rebuilt dist and the regenerated manifest files.
- Do **not** modify the `_validate` extract pipelines (`tools/_validate/`, `tools/notification-m-validate-app/`, `tools/storagefile-m-validate-app/`, etc.) — those use `sourcePath` for in-process AST work and never persist it.
- Do **not** strip `module` / `appRef` / `selector` / `className` / `slug` / `category` — those are the lookup-keys consumers actually use.
- After completing, write a change-log entry to `~/.claude/cloud-sync/log/dbcomponents/slim-mcp-manifests-drop-source-paths.md` mirroring the format of the existing `slim-dbx-docs-ui-examples-manifest.md` log entry.
