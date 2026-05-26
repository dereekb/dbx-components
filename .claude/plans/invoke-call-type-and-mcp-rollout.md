# Plan — `invoke` call type + `@dereekb/firebase-server/mcp` sub-package + demo MCP wiring

## Goal

Land the last two pieces of the MCP rollout in a single coordinated change:

1. A new sixth call type — **`invoke`** — that sits alongside `create / read / update / delete / query` (CRUDQI). Every `invoke` is bound to a model type; there is no global-level invoke. The CLI's `ActionCommandSpec` retains its global form (CLI-local composition only — not exposed over the API or MCP).
2. A new `@dereekb/firebase-server/mcp` sub-package that mounts MCP over HTTP, generates tools from `_apiDetails`, and reuses the existing `ModelApiCallModelDispatchService` for execution.
3. Wire both into `apps/demo-api` so the demo app exposes at least one `invoke` handler and a working MCP endpoint.

## Why invoke exists alongside CRUD

Some operations (regenerate-thumbnails, resync-with-external, recompute-index) aren't natural fits for any CRUD verb — they have side effects so they aren't `read`, they don't fit the `create/update/delete` shape of a single document mutation, and they aren't paginated lookups so they aren't `query`. Today these get smashed into `read` or `update` with a specifier, which:

- Pollutes the OIDC scope story (`model.read` should mean read-only).
- Pollutes analytics (idempotent reads vs. side-effecting RPCs read identically in the call tree).
- Confuses MCP clients about what a tool will do.

`invoke` is the dedicated home for these side-effecting RPC-style calls, with its own scope (`model.invoke`) and its own tool labeling in the MCP layer.

## Decisions already locked in

- Name is **`invoke`** (rejected: action, tool, command, run — see prior conversation; CRUDQ + I is the chosen acronym shape).
- **Model-bound only.** No global-level invokes on the API/MCP side. Things with no model affinity stay as plain Firebase callables. If something feels global, bind it to whichever model it conceptually serves (or to `systemState`, which already exists in the demo).
- **CLI keeps its `ActionCommandSpec`** unchanged — global form is fine because it's a CLI-local composition concern, not an API surface.
- **Auth/permission story is identical to CRUD.** Each invoke handler runs `useModel()` for permission checking just like an update handler.
- **Sub-package mirrors `firebase-server/oidc`** layout (peer dep on `firebase-server`, separate Nx project, `@dereekb/firebase-server/mcp` import path).
- **MCP SDK**: `@modelcontextprotocol/sdk` with `StreamableHTTPServerTransport`, no `@rekog/mcp-nest` dependency (reference its source only).
- **MCP auth reuses the existing OIDC bearer-token middleware.** No separate Firebase auth path.

## Phase A — `invoke` call type

### A1. Core type extension (`packages/firebase/src/lib/common/model/function.ts`)

- Extend `KnownOnCallFunctionType` from `'create' | 'read' | 'update' | 'delete' | 'query'` to also include `'invoke'`.
- Add `onCallInvokeModelParams = onCallTypedModelParamsFunction('invoke')`.
- Add `OnCallInvokeModelParams<T> = OnCallTypedModelParams<T>` type alias.

### A2. OIDC scope (`packages/firebase/src/lib/common/auth/oidc/oidc.ts`)

- Add `INVOKE_MODEL_OIDC_SCOPE = 'model.invoke' as const` and matching `InvokeModelOidcScope` type.
- Extend the `CALL_MODEL_OIDC_SCOPES` tuple.
- Extend the `CallModelOidcScope` union.
- Add `invoke: 'model.invoke'` to `CALL_MODEL_OIDC_SCOPE_FOR_CALL_TYPE`.
- Add the scope description entry to `CALL_MODEL_OIDC_SCOPE_DETAILS` ("Invoke model operations", "Invoke RPC-style operations on model records via the callModel API").
- Update the spec at `packages/firebase-server/oidc/src/lib/scope.spec.ts` so the `CALL_MODEL_OIDC_SCOPES` expectation includes `'model.invoke'`.
- No change needed to `oidcCallModelScopePreAssert` itself — it picks up the new scope via `callModelOidcScopeForCallType` automatically.

### A3. Server-side invoke factory (`packages/firebase-server/src/lib/nest/model/invoke.model.function.ts`)

New file mirroring `update.model.function.ts` structure. Invoke handlers should be auth-aware (like update) and accept a generic input/output shape. Pseudocode:

```typescript
export type OnCallInvokeModelRequest<N, I = unknown> =
  NestContextCallableRequestWithAuth<N, I> & ModelFirebaseCrudFunctionSpecifierRef;

export type OnCallInvokeModelFunctionWithAuth<N, I = unknown, O = unknown> = ...;
export type OnCallInvokeModelFunctionWithOptionalAuth<N, I = unknown, O = unknown> = ...;
export type OnCallInvokeModelFunction<N, I = unknown, O = unknown> = ...;
export type OnCallInvokeModelFunctionAuthAware<N, I = unknown, O = unknown> = ...;

export type OnCallInvokeModelMap<N, T extends FirestoreModelIdentity = FirestoreModelIdentity> = {
  readonly [K in FirestoreModelTypes<T>]?: OnCallInvokeModelFunctionAuthAware<N, any, any>;
};

export interface OnCallInvokeModelConfig<N> {
  readonly preAssert?: AssertModelCrudRequestFunction<N, OnCallTypedModelParams>;
}

export function onCallInvokeModel<N>(map: OnCallInvokeModelMap<N>, config: OnCallInvokeModelConfig<N> = {}) {
  return _onCallWithCallTypeFunction(map as any, {
    callType: 'invoke',
    crudType: 'invoke', // see A4
    preAssert: config.preAssert as any,
    throwOnUnknownModelType: invokeModelUnknownModelTypeError
  });
}

export function invokeModelUnknownModelTypeError(modelType: FirestoreModelType) { ... }
```

Export the file from `packages/firebase-server/src/lib/nest/model/index.ts` alongside the other CRUD factories.

### A4. `crud.assert.function.ts` extension

Inspect `AssertModelCrudRequestFunctionContextCrudType` — extend the union from `'call' | 'create' | 'read' | 'update' | 'delete' | 'query'` to also include `'invoke'`. This is purely a type-level addition; consumers of `AssertModelCrudRequestFunction` won't need code changes.

### A5. `ModelApiController` dispatch update (`packages/firebase-server/src/lib/nest/controller/model/model.api.controller.ts`)

- `ALLOWED_DISPATCH_METHODS` does not need to change — `POST/PUT` already covers `invoke`.
- The catch-all `_parsePath` flow already routes by the `call` segment, so `/api/model/storageFile/invoke/regenerateContent` works automatically once `'invoke'` is registered in the top-level `OnCallModelMap`.
- Confirm there are no other places that whitelist call types — `model.api.dispatch.ts` reads call type from `params.call` and passes it straight through, so the new type flows transparently.

### A6. Tests

- `invoke.model.function.spec.ts` — mirror `update.model.function.spec.ts` (auth assertion, unknown model type, specifier dispatch, `_apiDetails` aggregation).
- Extend `packages/firebase-server/oidc/src/lib/scope.spec.ts` with the new scope.
- Extend `apps/demo-api/src/app/server/model/model-api.controller.spec.ts` to assert `details.models[type].calls.invoke` shows up after demo wiring (see Phase C).

## Phase B — `@dereekb/firebase-server/mcp` sub-package

### B1. Project scaffold

Mirror the `packages/firebase-server/oidc/` layout exactly:

```
packages/firebase-server/mcp/
├── eslint.config.mjs              # extends ../../../eslint.config.library.mjs
├── package.json                   # name: @dereekb/firebase-server/mcp, peerDeps inc. @modelcontextprotocol/sdk
├── project.json                   # name: firebase-server-mcp, importPath: @dereekb/firebase-server/mcp
├── src/
│   ├── index.ts                   # export * from './lib';
│   └── lib/
│       ├── index.ts
│       ├── mcp.module.ts          # mcpModuleMetadata({ dependencyModule }) factory
│       ├── mcp.config.ts          # McpModuleConfig (issuer URL for protected-resource discovery)
│       ├── controller/
│       │   ├── index.ts
│       │   ├── mcp.controller.ts                # POST /mcp (Streamable HTTP transport)
│       │   └── mcp.wellknown.controller.ts      # GET /.well-known/oauth-protected-resource
│       ├── service/
│       │   ├── index.ts
│       │   ├── mcp.server.factory.ts            # builds McpServer, registers tools from _apiDetails
│       │   ├── mcp.tool-generator.ts            # walks ModelApiDetailsResult → MCP tool defs
│       │   └── mcp.response-formatter.ts        # Tier 1/2/3 response formatting
│       └── transport/
│           ├── index.ts
│           └── streamable-http.transport.ts     # session lifecycle for StreamableHTTPServerTransport
├── tsconfig.json
├── tsconfig.lib.json
├── tsconfig.spec.json
└── vitest.config.mts
```

Add to root `tsconfig.base.json` paths: `"@dereekb/firebase-server/mcp": ["packages/firebase-server/mcp/src/index.ts"]`.

`package.json` peerDeps include: `@dereekb/firebase`, `@dereekb/firebase-server`, `@dereekb/firebase-server/oidc`, `@dereekb/util`, `@nestjs/common`, `@nestjs/core`, `@modelcontextprotocol/sdk`, `express`. The `@modelcontextprotocol/sdk` version must match what's already declared in `dbx-components-mcp` (currently used for the prose MCP server) to avoid bundle drift.

### B2. Tool generation (`mcp.tool-generator.ts`)

Input: `ModelApiDetailsResult` from `getModelApiDetails(callModelFn)`.

For each `(modelType, callType, specifier)` triple in the tree, produce one MCP tool definition:

- **Tool name**: `<modelType>-<callType>-<specifier>` for actual specifiers, or `<modelType>-<callType>` when the specifier is the default `_`. Examples: `guestbook-create`, `profile-update-username`, `storageFile-invoke-regenerateContent`.
- **Description**: `mcp.description` if provided; otherwise auto-generated from the triple.
- **Input schema**: `inputType.toJsonSchema(jsonSchemaOptions)` where `jsonSchemaOptions` carries ArkType's `predicate`/`undefinedAsClearable` fallback handlers (per the known ArkType limitation in `model-call-mcp-server.md`).
- **Handler binding**: the tool's invoke handler builds `OnCallTypedModelParams { call, modelType, specifier, data }` and delegates to `ModelApiCallModelDispatchService.dispatch()`.

Skip tools whose handler has no `inputType` (can't generate a schema) but log them at startup so the gap is visible.

### B3. Response formatting (`mcp.response-formatter.ts`)

Implement the three-tier resolution already defined on `OnCallModelFunctionMcpDetails`:

1. **Tier 3** — if `formatResponse` is set, call it directly; return its `McpToolResponseContent`.
2. **Tier 2** — if `summarizeResponse` is set, wrap the returned string in `{ content: [{ type: 'text', text: summary }], structuredContent: result }`.
3. **Tier 1** — default: stringify result as JSON in a text block, attach as `structuredContent`.

Errors from the dispatch chain are converted to `{ isError: true, content: [{ type: 'text', text: error.message }] }`.

### B4. Streamable HTTP transport (`streamable-http.transport.ts`)

`@modelcontextprotocol/sdk` ships `StreamableHTTPServerTransport`. Wire it into a NestJS controller:

- `POST /mcp` — handles JSON-RPC over Streamable HTTP. Each request gets a fresh transport instance (stateless mode) — simpler than session-tracked mode and adequate for Claude custom-connector usage.
- Reuse `@rekog/mcp-nest` source as a reference for transport lifecycle but don't depend on it.
- Auth: reuse the existing OIDC bearer middleware (`OauthAuthMiddleware` from `firebase-server/oidc`). Configure the MCP module to apply it to `/mcp`.

### B5. Protected-resource discovery (`mcp.wellknown.controller.ts`)

`GET /.well-known/oauth-protected-resource` returns:

```json
{
  "resource": "https://<host>/mcp",
  "authorization_servers": ["https://<host>/oidc"]
}
```

Both URLs are computed from `McpModuleConfig` (`mcpUrl`, `oidcIssuer`). Claude custom-connector reads this to discover the OIDC issuer.

### B6. Module metadata factory (`mcp.module.ts`)

Mirror `modelApiModuleMetadata`:

```typescript
export interface McpModuleMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  readonly dependencyModule: ClassType;
}

export function mcpModuleMetadata(metadataConfig: McpModuleMetadataConfig): ModuleMetadata { ... }
```

The dependency module must provide `ModelApiDispatchConfig` (so we reuse the already-wired `callModelFn` + `makeNestContext`) and `McpModuleConfig`.

### B7. Tests

- `mcp.tool-generator.spec.ts` — given a sample `ModelApiDetailsResult`, expect N tools with expected names/schemas.
- `mcp.response-formatter.spec.ts` — verify Tier 1/2/3 resolution order.
- `mcp.controller.spec.ts` — round-trip a `tools/list` and `tools/call` request through the transport with a mocked dispatch service.

## Phase C — Demo wiring (`apps/demo-api`)

### C1. Demo invoke handler

Add at least one real invoke handler so the type is exercised end-to-end. Strong candidate: `storageFileGroupRegenerateContent` already exists as an `update` specifier in `DEMO_UPDATE_MODEL_MAP` — it's semantically an invoke, not an update. **Don't move it yet** (would be a breaking API change for any existing caller). Instead add a fresh handler:

- File: `apps/demo-api/src/app/function/storagefile/storagefile.invoke.ts`
- Handler: `storageFileRecomputeChecksums` (or similar — must be side-effecting, fits the invoke verb).
- Uses `withApiDetails({ inputType, mcp: { description }, fn })`.

### C2. Invoke map + crud.functions.ts wiring

In `apps/demo-api/src/app/function/model/crud.functions.ts`:

```typescript
// MARK: Invoke
export const DEMO_INVOKE_MODEL_MAP: DemoOnCallInvokeModelMap = {
  storageFile: onCallSpecifierHandler({
    recomputeChecksums: storageFileRecomputeChecksums
  })
};

// MARK: Call
export const DEMO_CALL_MODEL_MAP: OnCallModelMap = {
  create: onCallCreateModel(DEMO_CREATE_MODEL_MAP),
  read: onCallReadModel(DEMO_READ_MODEL_MAP),
  update: onCallUpdateModel(DEMO_UPDATE_MODEL_MAP),
  delete: onCallDeleteModel(DEMO_DELETE_MODEL_MAP),
  query: onCallQueryModel(DEMO_QUERY_MODEL_MAP),
  invoke: onCallInvokeModel(DEMO_INVOKE_MODEL_MAP)
};
```

Add `DemoOnCallInvokeModelMap` / `DemoInvokeModelFunction` type aliases in `apps/demo-api/src/app/function/function.context.ts`.

### C3. Demo MCP module wiring

Populate the currently-empty `apps/demo-api/src/app/server/mcp/`:

```
apps/demo-api/src/app/server/mcp/
├── mcp.module.ts           # DemoMcpDependencyModule + DemoMcpModule
└── (later) tests
```

`mcp.module.ts` should mirror `model.module.ts`:

```typescript
@Module({
  imports: [DemoModelApiDependencyModule], // reuse the existing ModelApiDispatchConfig provider
  providers: [{ provide: McpModuleConfig, useValue: { ... } }],
  exports: [ModelApiDispatchConfig, McpModuleConfig]
})
export class DemoMcpDependencyModule {}

@Module(mcpModuleMetadata({ dependencyModule: DemoMcpDependencyModule }))
export class DemoMcpModule {}
```

Register `DemoMcpModule` in `apps/demo-api/src/app/server/server.module.ts`:

```typescript
@Module({
  imports: [DemoApiOidcModule, DemoModelApiModule, DemoMcpModule]
})
export class DemoApiServerModule {}
```

### C4. CLI manifest regeneration

The generated `apps/demo-cli/src/lib/manifest/api.manifest.generated.ts` reads the call model map. Regenerate it after `DEMO_INVOKE_MODEL_MAP` lands so the demo-cli surfaces `model storageFile invoke recompute-checksums` automatically (no CLI code changes required — the manifest commands builder handles it).

### C5. End-to-end test

Add `apps/demo-api/src/app/server/mcp/mcp.controller.e2e.spec.ts` (or equivalent integration) that:

1. Boots the NestJS app with the OIDC + ModelApi + MCP modules wired together.
2. Calls `POST /mcp` with a JSON-RPC `tools/list` and asserts `storageFile-invoke-recomputeChecksums` is present with the expected input schema.
3. Calls `tools/call` for the same tool with valid params and asserts the dispatch service receives the right `OnCallTypedModelParams`.

## Phase D — Documentation + downstream cleanup

### D1. dbx-components-mcp catalog awareness

`packages/dbx-components-mcp/src/registry/` and the related extractors enumerate call types in some places. Grep for `'create' | 'read' | 'update' | 'delete' | 'query'` across that package and extend any literal lists to include `invoke`. The catalog is regenerated via `regenerate-dbx-components-mcp.sh` after the change.

### D2. Skill / prose updates

- `dbx__guide__call-model-api` — document the new `invoke` verb and its semantics relative to CRUD.
- `dbx__ref__dbx-api-backend` — mention `onCallInvokeModel` alongside the other CRUD factories.

### D3. Plan-doc cleanup

Mark Phase 4 + Phase 5 of `~/.claude/cloud-sync/planning/dbx-components/model-call-mcp-server.md` as complete once this rollout lands.

## Execution order

Phases are listed in dependency order; within each phase the steps are roughly sequential but the file-level work inside a phase is parallelizable.

1. **A1 → A2 → A3 → A4 → A5 → A6**. Land the call-type infra first so demo + MCP can both consume it. Get tests green before moving on.
2. **B1 → B2 → B3 → B4 → B5 → B6 → B7**. Scaffold the sub-package, get tool generation + transport working with a stubbed dispatch service, then write tests.
3. **C1 → C2 → C3 → C4 → C5**. Wire the demo. C5 is the smoke test that proves the whole stack works.
4. **D1 → D2 → D3**. Documentation and follow-up — does not block the merge.

## Risks / open questions

- **ArkType `toJsonSchema()` failures on existing handler types.** The tool generator must call `toJsonSchema()` with the right fallback options. Some handlers will throw; log + skip rather than fail boot. Track the gaps so each can be fixed at the type level.
- **Streamable HTTP session model.** Stateless per-request transport is simpler but may need revisiting if Claude expects long-lived sessions for streaming tool output. Start stateless; revisit only if Claude misbehaves.
- **CORS for `/.well-known/oauth-protected-resource`.** Claude fetches it from the browser-side; needs `Access-Control-Allow-Origin` set. The OIDC sub-package already configures CORS via `OauthCorsModule` — confirm the MCP controller picks up the same allow-list.
- **`AssertModelCrudRequestFunctionContextCrudType` consumers.** Extending the union should be a non-breaking type change since all current consumers handle it via the catch-all string fallback. Grep before extending to confirm no exhaustiveness switches need new cases.
- **Existing `storageFileGroupRegenerateContent` migration.** It lives under `update` today. Don't move it in this PR — that's a follow-up cleanup once the demo `invoke` handler proves the path.

## Related files (quick index)

- `packages/firebase/src/lib/common/model/function.ts` — `KnownOnCallFunctionType`, `onCallTypedModelParamsFunction`
- `packages/firebase/src/lib/common/auth/oidc/oidc.ts` — OIDC scope definitions
- `packages/firebase-server/src/lib/nest/model/call.model.function.ts` — `onCallModel`, `_onCallWithCallTypeFunction`
- `packages/firebase-server/src/lib/nest/model/update.model.function.ts` — template for `invoke.model.function.ts`
- `packages/firebase-server/src/lib/nest/model/api.details.ts` — `getModelApiDetails`, `OnCallModelFunctionMcpDetails`
- `packages/firebase-server/src/lib/nest/controller/model/model.api.controller.ts` — REST analog already routes `:call` from path
- `packages/firebase-server/src/lib/nest/controller/model/model.api.module.ts` — `modelApiModuleMetadata` template
- `packages/firebase-server/src/lib/nest/controller/model/model.api.dispatch.ts` — `ModelApiCallModelDispatchService` (reused by MCP)
- `packages/firebase-server/oidc/` — sub-package layout reference for `packages/firebase-server/mcp/`
- `packages/firebase-server/oidc/src/lib/scope.ts` — `oidcCallModelScopePreAssert` (no change needed)
- `apps/demo-api/src/app/function/model/crud.functions.ts` — demo call model map
- `apps/demo-api/src/app/server/model/model.module.ts` — demo Model API wiring template
- `apps/demo-api/src/app/server/mcp/` — currently empty, target for `DemoMcpModule`
- `apps/demo-api/src/app/server/server.module.ts` — top-level wiring
- `apps/demo-cli/src/lib/manifest/api.manifest.generated.ts` — regenerated after invoke map lands
