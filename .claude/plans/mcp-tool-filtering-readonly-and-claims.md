# MCP Tool-List Filtering + Build-Time MCP Manifest Pipeline

Source prompt: `~/.claude/cloud-sync/prompts/dbcomponents/mcp-tool-filtering-readonly-and-claims.md`

Two coordinated changes:

1. Per-request `tools/list` filtering in `@dereekb/firebase-server/mcp` on three axes — OIDC scope, per-handler `visibility`, and module-level `readOnly`. Boot-time classification keeps per-request cost O(N-of-cheap-checks).
2. Build-time MCP manifest pipeline: a new `dbx-cli-generate-mcp-manifest` tool that pre-renders descriptions, `inputSchema`, and `outputSchema` from the existing `CliApiManifest`. Runtime loader consults the JSON map without any further processing.

## Design decisions captured upfront

These items diverge from or extend the prompt — call them out before coding so the user can redirect.

- **`FirebaseServerAuthData` does NOT expose `authRoles`.** The prompt at line 25 says it does, but `FirebaseServerAuthData` (in `packages/firebase-server/src/lib/nest/controller/auth.context.server.ts:10`) is just `AuthData & { uid }`. `authRoles` lives on the *constructed* `FirebaseServerAuthContext` (`auth.service.ts:425`) built downstream by `ModelApiCallModelDispatchService.dispatch()`. `tools/list` fires **before** dispatch, so we don't get the context for free.
  - **Resolution:** add a thin `McpAuthRoleReader` injection (function `(claims: AuthClaims) => AuthRoleSet`) that the host app provides via the existing `authRoleClaimsService(...).toRoles` from `@dereekb/util`. The factory injects it as optional — when absent, declarative `requiredRoles` checks always fail closed and emit a single boot-time warning. The demo app wires `DEMO_AUTH_CLAIMS_SERVICE.toRoles` as the implementation.
  - This keeps `firebase-server/mcp` free of a hard `@dereekb/util/auth` runtime dep beyond the type imports it already has.

- **`CliApiVerb` is stale.** The type union (`packages/dbx-cli/src/lib/manifest/types.ts:136`) lists `'create' | 'read' | 'update' | 'delete' | 'query' | 'standalone'`, but generated manifests already emit `verb: 'invoke'` (see `apps/demo-cli/src/lib/manifest/api.manifest.generated.ts:50`). The MCP-manifest tool will accept `verb` as a `string` and map it through `callModelOidcScopeForCallType` (which understands `invoke`). Not in scope to fix the upstream union — out-of-band cleanup.

- **`'standalone'` entries should be skipped.** The existing API-manifest generator already skips them (`main.ts:162`), and they never reach the callModel dispatch chain. The new MCP-manifest tool drops them too.

- **MCP manifest key format**: prompt says `${model}.${verb}.${specifier ?? '_'}`. Existing tool naming uses dashes (`${model}-${verb}-${specifier}`). Keep dot-keys for the manifest (caller-controlled) since they round-trip through `mcpManifestKey(...)` — the runtime composes the key from `(modelType, callType, specifier)` itself. Both forms can coexist; the wire tool name stays dash-form.

- **JSON schema output for `outputSchema` synthesis.** `paramsValidator.toJsonSchema()` gives us a real schema for the input side. For the result side we only have `resultFields[]` with `typeText` strings — no ArkType validator. Plan to translate a small `typeText` subset (`'string'`, `'number'`, `'boolean'`, `'Maybe<X>'`, `'X[]'`) into rough `{ type: ... }`; anything else falls through as `{ description }` only. The MCP SDK is lenient about partial schemas.

- **Atomic write.** The existing manifest generator does an in-place compare-and-write (no temp file). Prompt asks for temp→rename. We'll match the prompt — temp+rename keeps partial files off disk on Ctrl-C, no harm in over-specifying.

## Section-by-section checklist

### Section 1 — Per-handler `visibility` metadata

Files to edit:

- `packages/firebase-server/src/lib/nest/model/api.details.ts` — extend `OnCallModelFunctionMcpDetails` with:
  - `readonly visibility?: McpToolVisibility`
  - `readonly readOnly?: boolean` (also covers section 4 below)
- New file `packages/firebase-server/mcp/src/lib/service/mcp.visibility.ts` — exports:
  - `McpVisibilityRule { requiredRoles?, requireAuthenticated? }` (readonly)
  - `McpVisibilityContext { auth?, scopes?, tool }` (readonly)
  - `McpToolVisibility = boolean | McpVisibilityRule | ((ctx) => boolean)`
  - JSDoc the synchronous-only rule on the dynamic form, and the fail-closed-on-throw rule.

Tests (`mcp.visibility.spec.ts`):

- Construct each form and round-trip through `classifyVisibility(...)` (helper used by the tool generator). Verify it produces the right `visibilityKind`.

### Section 2 — Boot-time classification

Files to edit:

- `packages/firebase-server/mcp/src/lib/service/mcp.tool-generator.ts`:
  - Extend `McpToolDefinition` with one new field: `readonly filterMetadata: McpToolFilterMetadata`.
  - Add internal type `McpToolFilterMetadata`:
    ```ts
    interface McpToolFilterMetadata {
      readonly requiredScope?: CallModelOidcScope;
      readonly visibilityKind: 'always' | 'never' | 'declarative' | 'dynamic';
      readonly rule?: McpVisibilityRule;
      readonly visibilityFn?: (context: McpVisibilityContext) => boolean;
      readonly effectiveReadOnly?: boolean;          // explicit > inferred > undefined
    }
    ```
  - Helper `classifyVisibility(visibility?: McpToolVisibility): { visibilityKind, rule?, visibilityFn? }`.
  - Helper `resolveEffectiveReadOnly(handler.mcp?.readOnly, dispatch.call): boolean | undefined`.
    - `read`/`query` → true. `create`/`update`/`delete` → false. Other → undefined.
  - In `generateToolsForModelCall`, compute `requiredScope = callModelOidcScopeForCallType(call)`, classify visibility, and attach `filterMetadata` to each tool.
  - Partition: `McpToolGenerationResult` keeps both arrays — keep the existing `tools` for back-compat, add `neverVisibleTools` for `'never'` entries (separate so the per-request loop never touches them).

Tests (extend `mcp.tool-generator.spec.ts`):

- All three `visibility` forms classify into the right `visibilityKind`.
- `requiredScope` precomputed across `create`/`read`/`update`/`delete`/`query`/`invoke` and one unknown call type (no scope).
- `effectiveReadOnly` for: explicit `true`/`false` override, inferred read, inferred query, inferred create/update/delete, unknown call type → undefined.

### Section 3 — Per-request filter in `McpServerFactoryService`

Files to edit:

- `packages/firebase-server/mcp/src/lib/service/mcp.server.factory.ts`:
  - Inject optional `McpAuthRoleReader` (define in `mcp.module.ts` as `Optional()` provider). When absent, declarative `requiredRoles` checks fail closed and the factory emits one boot warning.
  - `createServer(ctx)` flow:
    1. `scopes = getOidcScopesFromRequest(ctx.rawRequest)` — call it once.
    2. Resolve `authRoles = ctx.auth?.token ? this.roleReader?.(ctx.auth.token as unknown as AuthClaims) : undefined`. The synthetic CallableRequest layering inside `dispatch.ts:83` shows `auth.token` carries the OIDC claims merged on top — same shape.
    3. Iterate `cachedTools.tools` (skip `cachedTools.neverVisibleTools` entirely). Build the filtered array:
       - Drop if `scopes != null && tool.filterMetadata.requiredScope != null && !scopes.has(tool.filterMetadata.requiredScope)`.
       - Drop if `this.mcpConfig.readOnly && tool.filterMetadata.effectiveReadOnly !== true`.
       - Visibility kind switch:
         - `'always'` → keep.
         - `'declarative'` → check `requireAuthenticated` against `ctx.auth != null`; check `requiredRoles` against `authRoles` (drop if `authRoles == null` or any role missing).
         - `'dynamic'` → invoke `visibilityFn({ auth: ctx.auth, scopes, tool: tool.dispatch })` in try/catch; drop on `false` or any throw; log warning on throw via `this._logger.warn`.
    4. Build `definitionsByName` Map from the filtered array.
    5. Append ` (read-only)` to `serverName` (handshake) when `this.mcpConfig.readOnly === true`.
    6. Existing `ListToolsRequestSchema` + `CallToolRequestSchema` wiring stays — they now consume the filtered list/map.
  - Keep `_resolveToolDefinitions()` cache as-is; classification result is per-process, filter result is per-request.

Tests (extend `mcp.server.factory.spec.ts`):

- Scope filter: OIDC caller with only `model.read` sees read tools but not create/update/delete.
- Non-OIDC caller (no `scope` claim): all tools visible (mirrors `oidcCallModelScopePreAssert` bypass).
- `visibility: false` always hidden.
- `visibility: true` still requires scope match.
- Declarative `requiredRoles: [AUTH_ADMIN_ROLE]` — admin caller sees, non-admin doesn't, role reader missing → drop + warn once.
- Declarative `requireAuthenticated: true` — anonymous caller (`ctx.auth == null`) is dropped.
- Dynamic function — receives `{ auth, scopes, tool }`; throw → drop + warn.
- `readOnly: true` config — drops writes (create/update/delete) and unknown classification; serverName includes ` (read-only)` suffix; reads/queries remain.
- Filtered-out tool name → `CallTool` returns the "Unknown tool" error path.

### Section 4 — `McpModuleConfig.readOnly` flag

Files to edit:

- `packages/firebase-server/mcp/src/lib/mcp.config.ts`:
  - Add `readonly readOnly?: boolean` to `McpModuleConfig`.
  - JSDoc the rule: when `true`, drops anything whose effective read-only is not strictly `true` (unknown counts as write — fail-safe).

The boot-time classification (section 2) computes `effectiveReadOnly` per tool. The per-request filter (section 3) applies the config's `readOnly` flag plus the per-tool `effectiveReadOnly`. No additional config plumbing.

### Section 5 — Build-time MCP manifest tool

New package directory: `packages/dbx-cli/generate-mcp-manifest/`.

Files to create:

- `packages/dbx-cli/generate-mcp-manifest/project.json` — clone the existing `firebase-api-manifest` project.json shape (`build` + `build-base`, esbuild ESM, node20, banner with shebang + createRequire).
- `packages/dbx-cli/generate-mcp-manifest/tsconfig.tool.json` — clone from `firebase-api-manifest` sibling.
- `packages/dbx-cli/generate-mcp-manifest/src/generate-mcp-manifest/main.ts` — entry point. Flags:
  - `--input=<path>` (required) — TS file exporting `<X>_API_MANIFEST: CliApiManifest`.
  - `--output=<path>` (required) — JSON destination.
  - `--regenerate-input` (flag) — when set and input is missing, invoke the existing manifest generator first. Best implementation: spawn `node dist/packages/dbx-cli/firebase-api-manifest/main.js` with the same flags the project's own `generate-api-manifest` target uses. Simpler interim: fail with a clear message linking the right `pnpm nx run …:generate-api-manifest` command. Pick one in the implementation pass.
- `packages/dbx-cli/generate-mcp-manifest/src/generate-mcp-manifest/render.ts` — pure renderer that takes a `CliApiManifest` and returns the `McpManifest` object. Houses the description merge, schema enrichment, and `outputSchema` synthesis.
- `packages/dbx-cli/generate-mcp-manifest/src/generate-mcp-manifest/render.spec.ts` — co-located tests.

Files to edit:

- `packages/dbx-cli/package.json` — add `"dbx-cli-generate-mcp-manifest": "generate-mcp-manifest/main.js"` to `bin`, and a `"./generate-mcp-manifest"` exports entry.
- `packages/dbx-cli/src/lib/manifest/types.ts` — append:
  ```ts
  export const MCP_MANIFEST_VERSION = 1 as const;

  export interface McpManifestToolEntry {
    readonly description?: string;
    readonly inputSchema?: object;
    readonly outputSchema?: object;
  }

  export interface McpManifest {
    readonly version: typeof MCP_MANIFEST_VERSION;
    readonly generatedAt: string;
    readonly tools: { readonly [key: string]: McpManifestToolEntry | undefined };
  }

  export function mcpManifestKey(modelType: string, call: string, specifier?: Maybe<string>): string {
    const isDefault = specifier == null || specifier === '_';
    return isDefault ? `${modelType}.${call}._` : `${modelType}.${call}.${specifier}`;
  }
  ```

Render rules (mirrors prompt §5):

1. Skip entries with `verb === 'standalone'`.
2. `key = mcpManifestKey(entry.model, entry.verb, entry.specifier)`.
3. `description`:
   - `[entry.description, entry.paramsTypeDescription].filter(Boolean).join('\n\n')`. Omit field when result is empty.
4. `inputSchema`:
   - `schema = entry.paramsValidator?.toJsonSchema(DEFAULT_JSON_SCHEMA_GENERATION_OPTIONS)` (import the constant from `@dereekb/firebase-server/mcp`).
   - Walk `entry.paramsFields ?? []`. For each field, if `schema.properties?.[field.name]` exists and lacks a `description`, set it from `field.description`. Also fill `type` from `typeText` if missing (best-effort; described above).
   - Omit `inputSchema` entirely when neither validator nor fields produced a schema.
5. `outputSchema`:
   - When `entry.resultFields` and/or `entry.resultTypeDescription`: build `{ type: 'object', description?: resultTypeDescription, properties: { ... } }` from `resultFields`. Translate `typeText` per the small-subset mapping above.
   - Omit entirely when both are absent.
6. Drop `paramsTypeName`, `resultTypeName`, `paramsValidator`, `groupName`, `sourceFile` from the JSON output.
7. Write to `<output>.tmp`, then `fs.renameSync` to `<output>`. `ensureOutputDir` first.

Tests (`render.spec.ts`):

- Pre-merged `description` with both, only `description`, only `paramsTypeDescription`, neither.
- `inputSchema` enrichment fills missing `description` on `properties[name]` from `paramsFields`. Does not overwrite existing.
- `outputSchema` synthesized from `resultFields` + `resultTypeDescription`; omitted when both absent.
- Trimming drops `paramsTypeName`, `resultTypeName`, `paramsValidator`, `groupName`, `sourceFile`.
- Key format: default specifier collapses to `_`; explicit specifier preserved.
- `verb: 'standalone'` entries skipped.

Tests (`main.spec.ts` — optional, drives the I/O wrapper):

- Atomic write: temp file created and renamed; final file matches the rendered object.
- Missing `--input` without `--regenerate-input` exits non-zero with a clear message.

### Section 6 — Runtime consumption in the MCP module

Files to edit:

- `packages/firebase-server/mcp/src/lib/mcp.config.ts`:
  - Add `readonly mcpManifestPath?: string`. JSDoc — points at the JSON file path; module loads at boot, no per-request file I/O.

- `packages/firebase-server/mcp/src/lib/service/mcp.tool-generator.ts`:
  - Extend `generateMcpToolDefinitions(apiDetails, options, manifest?)` with an optional third arg `manifest?: ReadonlyMap<string, McpManifestToolEntry>`. Pure addition.
  - In `generateToolsForModelCall`:
    - Resolve manifest entry via `manifest.get(mcpManifestKey(modelType, callType, specifierKey))`.
    - `description`: handler `mcp?.description` (explicit) > `manifestEntry?.description` > existing `buildDefaultMcpToolDescription(...)`.
    - `inputSchema`: `manifestEntry?.inputSchema` > existing ArkType-derived path > undefined (skipped tool as today).
    - Carry `manifestEntry?.outputSchema` onto a new `outputSchema?: object` field of `McpToolDefinition`.

- `packages/firebase-server/mcp/src/lib/service/mcp.server.factory.ts`:
  - On first `_resolveToolDefinitions()` call, if `mcpConfig.mcpManifestPath` is set:
    - `fs.readFileSync(path, 'utf8')` and `JSON.parse`. Validate `version === MCP_MANIFEST_VERSION`. On mismatch → `_logger.warn` and treat as missing.
    - Build `manifestMap: Map<string, McpManifestToolEntry>`. Log `info` once with entry count.
    - On missing file → `_logger.warn` and treat as missing.
    - Pass `manifestMap` into `generateMcpToolDefinitions(...)`.
  - In the `ListToolsRequestSchema` handler, include `outputSchema` only when set AND the pinned MCP SDK type allows it. Check `packages/firebase-server/mcp/package.json` for the `@modelcontextprotocol/sdk` version. As of this plan, **TBD during implementation** — confirm v0.6+ before adding to the wire response.

Tests (extend `mcp.tool-generator.spec.ts`):

- Resolution order on `description`: handler explicit > manifest > default.
- Manifest-provided `inputSchema` overrides ArkType-derived schema.
- `outputSchema` attached to the definition when manifest provides one.

Tests (extend `mcp.server.factory.spec.ts` or new `mcp.server.factory.manifest.spec.ts`):

- Missing `mcpManifestPath` — no enrichment, no crash, info log.
- Wrong `version` — warn log, treated as missing.
- Successful load — info log with entry count, descriptions include `paramsTypeDescription` text.

### Section 7 — Demo wiring

Files to edit:

- `apps/demo-api/project.json`:
  - Add `generate-mcp-manifest` target:
    ```json
    "generate-mcp-manifest": {
      "executor": "nx:run-commands",
      "outputs": ["{workspaceRoot}/dist/apps/demo-api/mcp.manifest.json"],
      "dependsOn": [
        { "projects": ["demo-cli"], "target": "generate-api-manifest" },
        { "projects": ["dbx-cli-generate-mcp-manifest"], "target": "build" }
      ],
      "inputs": [
        "{workspaceRoot}/apps/demo-cli/src/lib/manifest/api.manifest.generated.ts",
        "{workspaceRoot}/dist/packages/dbx-cli/generate-mcp-manifest/main.js"
      ],
      "options": {
        "command": "node dist/packages/dbx-cli/generate-mcp-manifest/main.js --input=apps/demo-cli/src/lib/manifest/api.manifest.generated.ts --output=dist/apps/demo-api/mcp.manifest.json",
        "cwd": "{workspaceRoot}"
      }
    }
    ```
  - Append `"generate-mcp-manifest"` to the `build` target's `dependsOn` (currently empty in the `build` wrapper — add `dependsOn: ["generate-mcp-manifest", "^build"]`).

- `apps/demo-api/src/app/server/mcp/mcp.module.ts`:
  - In `demoMcpModuleConfigFactory`, set `mcpManifestPath: path.join(process.cwd(), 'dist/apps/demo-api/mcp.manifest.json')`. Resolve relative to cwd so both `serve` (workspace root cwd) and `run-emulators` (same) find the file.
  - Add a `McpAuthRoleReader` provider whose value is `DEMO_AUTH_CLAIMS_SERVICE.toRoles`. Imported from `components/demo-firebase/src/lib/auth/claims.ts`. Export from `DemoMcpDependencyModule`.

- Demo handler annotations — at least one of each:
  - `notification-*` write handler: `mcp: { visibility: { requiredRoles: [AUTH_ADMIN_ROLE] } }`. Find the candidate via the model API details tree.
    - Likely target: `notificationBox-update` or `notificationUser-update-resync` (those map to demo-MCP tools per the registered `demo-mcp` server).
  - One handler with `visibility: true` (no-op declaration, just to exercise the code path).
  - Optional: one dynamic — `visibility: ({ auth }) => Boolean(auth?.token?.featureFlag)` style.

## Verification (Done-when)

- `pnpm nx test firebase-server-mcp` — all new + existing specs pass.
- `pnpm nx test dbx-cli` — render + main specs pass.
- `pnpm nx run dbx-cli-generate-mcp-manifest:build` produces the binary.
- `pnpm nx run demo-api:generate-mcp-manifest` writes `dist/apps/demo-api/mcp.manifest.json` with non-zero `tools` count, `version: 1`, ISO `generatedAt`, descriptions including `paramsTypeDescription` text.
- `pnpm nx run demo-api:emulators` boots cleanly and logs the manifest-loaded message.
- `tools/list` against the running demo emulator (curl with admin OIDC token, non-admin token, anonymous) returns three distinct lists.

## Rules (from the prompt — load before each implementation chunk)

- Single-config-object params; readonly interface properties; no enums; string-literal unions only.
- No new runtime dependencies. `@dereekb/util` for role/claims types, `@dereekb/firebase` for scope types.
- No backwards-compat shims — every new field is optional.
- One-line JSDoc on each exported symbol; longer block where WHY isn't obvious (fail-closed on dynamic throw, unknown-call→write fail-safe).
- No narrating or task-referencing comments.
- Use LSP for symbol navigation during `McpServerFactoryService` refactor.

## Execution order (resumable across sessions)

Each chunk lands as one commit so the WIP route-resolve-url branch stays clean.

1. **Chunk A — Section 1 + Section 2 + tool-generator tests.** Foundation. No behavior change yet (no per-request consumer).
2. **Chunk B — Section 3 + Section 4 + factory tests.** Filter goes live. `tools/list` starts returning filtered results.
3. **Chunk C — Section 5: dbx-cli-generate-mcp-manifest tool + tests.** Standalone — no firebase-server changes.
4. **Chunk D — Section 6: runtime manifest loader + tests.** Connects the build output to the runtime.
5. **Chunk E — Section 7: demo wiring + manual `tools/list` verification under emulators.** Closes the loop.

Open follow-ups (tracked here, not blockers):

- Decide whether to fix the stale `CliApiVerb` union (`'standalone'` vs missing `'invoke'`) in a separate PR.
- Long-term: lift the role reader pattern into a published helper if a second MCP-hosting app appears.
