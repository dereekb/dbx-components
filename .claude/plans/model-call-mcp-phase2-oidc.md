# Phase 2: OIDC Provider — Implementation Plan

## Context

This is Phase 2 of the Model Call MCP Server plan. Phase 1 (encrypted snapshot fields, `withApiDetails` types, aggregation, demo handler retrofits) is complete on `develop`. Phase 2 builds the OIDC provider infrastructure needed before the MCP server (Phase 4) can authenticate users.

We built two new sub-packages:
- **`@dereekb/firebase-server/oidc`** — server-side OIDC provider (NestJS + oidc-provider)
- **`@dereekb/dbx-firebase/oidc`** — frontend Angular components (login, consent, DCR management)

Full planning doc: `~/.claude/cloud-sync/planning/dbcomponents/model-call-mcp-server.md`

---

## Checklist

### Part A: Scaffolding & Dependencies

#### A1. Scaffold `firebase-server/oidc` sub-package
- [x] Create `packages/firebase-server/oidc/` directory
- [x] Create `package.json` — name `@dereekb/firebase-server/oidc`, version `13.2.0`, peerDependencies matching pattern from mailgun sub-package (add `oidc-provider` peer dep)
- [x] Create `project.json` — name `firebase-server-oidc`, `@nx/rollup:rollup` build-base, importPath `@dereekb/firebase-server/oidc`, outputPath `dist/packages/firebase-server/oidc`, format `["esm", "cjs"]`, external `"all"`, compiler `"tsc"`
- [x] Create `tsconfig.json` — extends `../../../tsconfig.base.json`, references to lib and spec
- [x] Create `tsconfig.lib.json` — extends `./tsconfig.json`, declaration true, exclude specs
- [x] Create `tsconfig.spec.json` — extends `./tsconfig.json`, vitest types
- [x] Create `vitest.config.mts` — `createVitestConfig({ type: 'firebase', pathFromRoot: __dirname, projectName: 'firebase-server-oidc' })`
- [x] Create `eslint.config.mjs` — import from parent `../eslint.config.mjs`
- [x] Create `src/index.ts` — `export * from './lib'`
- [x] Create `src/lib/index.ts` — barrel
- [x] Update `packages/firebase-server/package.json` — add `"./oidc"` export entry (module/types/import/default pattern)
- [x] Update `packages/firebase-server/project.json` — add `npx nx run firebase-server-oidc:build-base` to build commands array
- [x] Update `tsconfig.base.json` — add `"@dereekb/firebase-server/oidc": ["packages/firebase-server/oidc/src/index.ts"]` to paths

#### A2. Scaffold `dbx-firebase/oidc` sub-package
- [x] Create `packages/dbx-firebase/oidc/` directory
- [x] Create `package.json` — name `@dereekb/dbx-firebase/oidc`, version `13.2.0`, peerDependencies for Angular + dbx packages
- [x] Create `project.json` — name `dbx-firebase-oidc`, `@nx/angular:package` build-base, ng-package.json reference
- [x] Create `ng-package.json`
- [x] Create `tsconfig.json` — extends `../../../tsconfig.base.json`, Angular compiler options (strictTemplates, etc.), references to lib/lib.prod/spec
- [x] Create `tsconfig.lib.json` — extends `./tsconfig.json`, declaration + declarationMap, exclude specs
- [x] Create `tsconfig.lib.prod.json` — extends `./tsconfig.lib.json`, Angular prod options
- [x] Create `tsconfig.spec.json` — extends `./tsconfig.json`, vitest types
- [x] Create `vitest.config.mts` — `createVitestConfig({ type: 'angular', pathFromRoot: __dirname, projectName: 'dbx-firebase-oidc' })`
- [x] Create `eslint.config.mjs` — import from parent `../eslint.config.mjs`
- [x] Create `src/index.ts` — `export * from './lib'`
- [x] Create `src/lib/index.ts` — barrel
- [x] Update `packages/dbx-firebase/package.json` — add `"./oidc": {}` to exports
- [x] Update `packages/dbx-firebase/project.json` — add `npx nx run dbx-firebase-oidc:build-base:production` to build commands (before the completion script)
- [x] Update `tsconfig.base.json` — add `"@dereekb/dbx-firebase/oidc": ["packages/dbx-firebase/oidc/src/index.ts"]` to paths

#### A3. Install dependencies
- [x] Add `oidc-provider` (`^9.7.0`) to root `package.json` dependencies
- [x] Run `pnpm install`
- [x] Add `oidc-provider` to `firebase-server/oidc` sub-package peerDependencies
- [x] Verify build: `pnpm nx run firebase-server-oidc:build-base` and `pnpm nx run dbx-firebase-oidc:build-base`

Note: `nest-oidc-provider` was not used — we integrate `oidc-provider` directly via dynamic import.

### Part B: Firestore Adapter for oidc-provider

#### B1. Implement Firestore adapter
- [x] Create `packages/firebase-server/oidc/src/lib/adapter/` directory
- [x] Create `firestore.adapter.ts` — `createFirestoreOidcAdapterFactory()` factory function returning adapter class constructor implementing oidc-provider's Adapter interface
- [x] Implement `upsert(id, payload, expiresIn)` — write to Firestore collection, set `expiresAt` timestamp for TTL
- [x] Implement `find(id)` — simple doc lookup by ID, with TTL expiry check
- [x] Implement `findByUserCode(userCode)` — query by `userCode` field (device flow)
- [x] Implement `findByUid(uid)` — query by `uid` field (session lookup)
- [x] Implement `consume(id)` — set `consumed` timestamp on doc
- [x] Implement `destroy(id)` — delete doc
- [x] Implement `revokeByGrantId(grantId)` — query by `grantId`, batch delete all matching docs (only for grantable models)
- [x] Support configurable collection prefix (default: `oidc_`)
- [x] Each model type maps to its own collection (e.g., `oidc_sessions`, `oidc_accesstokens`)
- [x] Create `adapter/index.ts` barrel and export from `lib/index.ts`
- [x] Custom `OidcAdapter`, `OidcAdapterConstructor`, `OidcAdapterPayload` type definitions (oidc-provider is ESM-only, no shipped types)

#### B2. Adapter tests (15 tests)
- [x] Create `firestore.adapter.spec.ts` — unit tests with mocked Firestore
- [x] Test all 7 adapter methods
- [x] Test TTL field calculation from `expiresIn` seconds
- [x] Test expired doc returns undefined
- [x] Test `revokeByGrantId` batch delete
- [x] Test non-grantable models skip revocation
- [x] Test configurable collection prefix

### Part C: JWKS Key Management

#### C1. Key model and types
- [x] Create `packages/firebase-server/oidc/src/lib/jwks/` directory
- [x] Create `jwks.ts` — types: `JwksKeyStatus`, `JwksKeyDocument`, `JsonWebKeyWithKid`, `JwksServiceConfig`
- [x] Encryption handled directly in service (AES-256-GCM, matching Phase 1 pattern)

#### C2. Key management service
- [x] Create `jwks.service.ts` — NestJS injectable service with `JWKS_SERVICE_CONFIG_TOKEN` and `GCS_STORAGE_TOKEN` DI tokens
- [x] Implement `generateKeyPair()` — create RSA 2048 key pair (RS256), store encrypted private key + plain public key in Firestore, set status `active`
- [x] Implement `getActiveSigningKey()` — query Firestore for the single `active` key, return decrypted private key JWK
- [x] Implement `getPublicJwks()` — query all non-retired keys, return JWKS format `{ keys: [...publicKeys] }`
- [x] Implement `rotateKeys()` — mark current active as `rotated` with expiresAt, generate new active key
- [x] Implement `publishJwksToGcs(bucket, path)` — upload JWKS JSON to GCS with `Cache-Control: public, max-age=300, stale-while-revalidate=60`
- [x] Implement `retireExpiredKeys()` — mark rotated keys as retired once expiresAt has passed

#### C3. JWKS tests (11 tests)
- [x] Test key pair generation and Firestore storage
- [x] Test encrypted private key (not plain JSON)
- [x] Test active key retrieval (decrypted, contains private 'd' component)
- [x] Test no active key returns undefined
- [x] Test rotation flow (old key → rotated, new key → active)
- [x] Test both keys in JWKS after rotation
- [x] Test public JWKS output format (no 'd' component)
- [x] Test GCS publish throws without storage configured
- [x] Test GCS publish (mocked)
- [x] Test retire expired keys
- [x] Test non-expired keys not retired

### Part D: findAccount Implementation

#### D1. Account bridge
- [x] Create `packages/firebase-server/oidc/src/lib/account/` directory
- [x] Create `find-account.ts` — `createFindAccount(auth)` factory function
- [x] Uses Firebase Admin Auth `getUser(uid)`
- [x] Returns `OidcAccount` with `accountId` = uid and `claims()` method
- [x] Claims mapping: `sub` = uid, `email`, `email_verified`, `name` = displayName, `picture` = photoURL
- [x] Scope-filtered: only includes profile claims for `profile` scope, email claims for `email` scope
- [x] Handle `auth/user-not-found` gracefully (return undefined)

#### D2. findAccount tests (9 tests)
- [x] Test successful user lookup and accountId
- [x] Test claims with sub = uid
- [x] Test user not found returns undefined
- [x] Test profile scope includes name/picture
- [x] Test email scope includes email/email_verified
- [x] Test profile scope excludes email claims
- [x] Test email scope excludes profile claims
- [x] Test all scopes includes everything
- [x] Test openid-only scope returns only sub

### Part E: NestJS OIDC Module

#### E1. Module configuration
- [x] Create `packages/firebase-server/oidc/src/lib/module/` directory
- [x] Create `oauth.config.ts` — `OAuthModuleConfig` interface, `OAuthTokenLifetimes`, `DEFAULT_TOKEN_LIFETIMES`, `OAUTH_MODULE_CONFIG_TOKEN`
- [x] Create `oauth.module.ts` — `OAuthModule` with both `forRoot()` and `forRootAsync()` patterns
- [x] `forRootAsync()` supports injected dependencies (Firestore, Auth from Firebase app)
- [x] Integrates oidc-provider directly via dynamic `import('oidc-provider')` (ESM-only)
- [x] Auto-generates initial JWKS signing key if none exists
- [x] Configure features: authorization code + PKCE (S256 mandatory), refresh token rotation, DCR (RFC 7591)
- [x] Disable: implicit flow, ROPC flow (only `code` response type, `authorization_code` + `refresh_token` grant types)
- [x] Token lifetimes: access tokens 15min, refresh tokens 30 days, auth codes 60s
- [x] Custom `oidc-provider.d.ts` type declaration file

#### E2. Protected resource discovery
- [x] Create `oauth.controller.ts` — serves `GET /.well-known/oauth-protected-resource` returning `{ authorization_servers: [issuerUrl] }`

#### E3. Interaction routes
- [x] Create `interaction.controller.ts` — NestJS controller
- [x] `GET /interaction/:uid` — detect interaction type (login or consent), redirect to frontend
- [x] `POST /interaction/:uid/login` — receive auth proof from frontend, call `provider.interactionFinished()`
- [x] `POST /interaction/:uid/consent` — receive consent decision, handle grant creation/update, call `provider.interactionFinished()`
- [x] `LoginInteractionBody` and `ConsentInteractionBody` DTOs

### Part F: Firebase Auth Middleware

#### F1. Bearer token middleware
- [x] Create `packages/firebase-server/oidc/src/lib/middleware/` directory
- [x] Create `oauth-auth.middleware.ts` — `OAuthBearerTokenMiddleware` NestJS middleware
- [x] Extract `Authorization: Bearer <token>` from request header
- [x] Verify token via oidc-provider's `AccessToken.find()` (opaque tokens)
- [x] Extract `sub` claim = Firebase UID
- [x] Build `OAuthAuthContext` compatible with `CallableRequest.auth` shape: `{ uid, token: { sub, scope, client_id } }`
- [x] Attach as `req.oauthAuth` via `OAuthAuthenticatedRequest` interface

#### F2. Middleware module
- [x] Create `oauth-auth.module.ts` — `ConfigureOAuthAuthMiddlewareModule` following the `ConfigureFirebaseAppCheckMiddlewareModule` pattern
- [x] Applies to `mcp/*path` routes by default
- [x] Export from barrel

#### F3. Middleware tests (4 tests)
- [x] Test valid bearer token → auth context attached, next() called
- [x] Test missing Authorization header → 401
- [x] Test non-Bearer auth header → 401
- [x] Test invalid/expired token → 401

### Part G: Frontend Components (`dbx-firebase/oidc`)

#### G1. OAuth login page
- [x] Create `packages/dbx-firebase/oidc/src/lib/login/` directory
- [x] Create `oauth-login.component.ts` — standalone Angular component (`DbxOAuthLoginComponent`)
- [x] Reads interaction UID from input or query params
- [x] `completeLogin(idToken)` method to submit Firebase ID token as auth proof
- [x] Loading/error state signals

#### G2. Consent screen
- [x] Create `packages/dbx-firebase/oidc/src/lib/consent/` directory
- [x] Create `oauth-consent.component.ts` — standalone component (`DbxOAuthConsentComponent`)
- [x] Shows client name, requested scopes
- [x] Approve/deny buttons → POST to interaction endpoint
- [x] `OAuthConsentScope` interface

#### G3. DCR management
- [x] Create `packages/dbx-firebase/oidc/src/lib/client-management/` directory
- [x] Create `oauth-client-list.component.ts` — `DbxOidcEntryClientListComponent` with `OAuthClient` interface
- [x] Create `oauth-client-detail.component.ts` — `DbxOidcEntryClientDetailComponent` with revoke action

#### G4. Service
- [x] Create `packages/dbx-firebase/oidc/src/lib/service/` directory
- [x] Create `oauth-interaction.service.ts` — `OAuthInteractionService` for backend communication

### Part H: Demo Integration

#### H1. Server integration
- [x] Create `apps/demo-api/src/app/common/firebase/oauth.module.ts` — `DemoApiOAuthModule` using `OAuthModule.forRootAsync()` with injected `FIREBASE_APP_TOKEN` and `FIREBASE_AUTH_TOKEN`
- [x] Import `DemoApiOAuthModule` into `DemoApiAppModule`
- [x] Export from common barrel

#### H2. Frontend integration
- [x] Add OAuth login route in demo app
- [x] Add consent route in demo app
- [x] Add DCR management route in demo app admin section
- [x] Wire components with demo app's existing auth flow

#### H3. Verification
- [x] `pnpm nx run firebase-server-oidc:build-base` — builds without errors
- [x] `pnpm nx run firebase-server-oidc:test` — all 39 tests pass
- [x] `pnpm nx run dbx-firebase-oidc:build-base` — builds without errors
- [x] `pnpm nx run firebase-server:build` — full parent build succeeds
- [x] `pnpm nx run dbx-firebase:build` — full parent build succeeds
- [ ] OIDC discovery endpoint returns valid configuration
- [ ] End-to-end: auth flow → token issuance → bearer token verification

### Part I: Revisit firebase-server/oidc — Align with firebase-server Model Patterns

The initial implementation used ad-hoc Firestore access. This part revisits the server-side code to align with the established `@dereekb/firebase-server` model patterns.

#### I1. JWKS model definition
- [ ] Study existing model patterns: `firestoreModelIdentity()`, `firestoreSubCollectionFactory()`, collection definitions in `demo-firebase`
- [ ] Define `jwksKeyIdentity` using `firestoreModelIdentity()` for the JWKS keys collection
- [ ] Define `JwksKeyDocument` as a proper Firestore document model with typed fields
- [ ] Use `firestoreEncryptedField()` from Phase 1 for the `privateKey` field instead of manual AES encrypt/decrypt
- [ ] Create a proper `JwksKeyCollectionFactory` or register via the collection system

#### I2. OIDC adapter model patterns
- [ ] Evaluate whether oidc-provider adapter collections (sessions, tokens, grants, etc.) should use full model definitions or remain lightweight (they are provider-internal, not app-domain models)
- [ ] If using model definitions: define identities and collection factories for each adapter model type
- [ ] If staying lightweight: document the reasoning and ensure the adapter factory still follows naming conventions

#### I3. NestJS module DI patterns
- [ ] Review `JwksService` DI — align with `@dereekb/nestjs` patterns (e.g., `mergeModuleMetadata()`, provider factory patterns)
- [ ] Review `OAuthModule.forRootAsync()` — ensure it follows the same patterns as `appFirestoreModuleMetadata()`, `firebaseServerAuthModuleMetadata()`, etc.
- [ ] Ensure Firestore collection access uses injected Firestore token (`FIREBASE_FIRESTORE_TOKEN`) rather than raw Firestore instance passed through config
- [ ] Review middleware module — align with `ConfigureFirebaseAppCheckMiddlewareModule` for route exclusion patterns

#### I4. Update tests
- [ ] Update JWKS tests to use the new model-based approach
- [ ] Ensure adapter tests still pass with any refactored collection access

### Part J: Revisit dbx-firebase/oidc — Align with @dereekb/dbx-web and @dereekb/dbx-firebase Patterns

The initial frontend components are minimal standalone components. This part revisits them to use the established UI component patterns from `@dereekb/dbx-web` and `@dereekb/dbx-firebase`.

#### J1. Study existing patterns
- [ ] Review `@dereekb/dbx-web` layout components (`dbx-web-layout` skill): section, content, block, detail patterns
- [ ] Review `@dereekb/dbx-web` action patterns (`dbx-web-actions` skill): action buttons, action directives
- [ ] Review `@dereekb/dbx-firebase` auth components: `DbxFirebaseLoginComponent`, `DbxFirebaseAuthService`, login flow patterns
- [ ] Review `@dereekb/dbx-core` patterns: `DbxActionDirective`, `DbxRouterService`, loading/error state handling

#### J2. Reimplement login component
- [ ] Use `DbxFirebaseAuthService` for the actual sign-in flow (not just accepting an ID token)
- [ ] Use `dbx-section`, `dbx-content-container`, or similar layout wrappers
- [ ] Use `DbxActionDirective` / action button patterns for the login action
- [ ] Integrate with `LoadingState` / `DbxLoadingComponent` for loading states
- [ ] Handle auth state reactively via observables rather than imperative signals where appropriate

#### J3. Reimplement consent component
- [ ] Use `dbx-section` / `dbx-detail` layout patterns for displaying client info and scopes
- [ ] Use `dbx-action-button` or Material button patterns for approve/deny
- [ ] Use `DbxActionDirective` for the consent submission action
- [ ] Style with existing Material Design theme tokens / CSS classes

#### J4. Reimplement client management components
- [ ] Use `dbx-list` / list item patterns from `@dereekb/dbx-web` for the client list
- [ ] Use `dbx-detail` patterns for client detail view
- [ ] Use action patterns for revoke action
- [ ] Consider using `DbxListViewComponent` or similar list infrastructure

#### J5. Service layer
- [ ] Review `OAuthInteractionService` — consider using `@dereekb/rxjs` patterns (e.g., `LoadingState`, `loadingStateFromObs()`)
- [ ] Consider whether the service should integrate with `@angular/fire` or use raw `HttpClient`
- [ ] Add proper error handling using `@dereekb/util` error patterns if applicable

---

## Critical Files

### New (created)
- `packages/firebase-server/oidc/` — entire sub-package (adapter, jwks, account, module, middleware)
- `packages/dbx-firebase/oidc/` — entire sub-package (login, consent, client-management, service)

### Modified (existing)
- `packages/firebase-server/package.json` — added `./oidc` export
- `packages/firebase-server/project.json` — added oidc build command
- `packages/dbx-firebase/package.json` — added `./oidc` export
- `packages/dbx-firebase/project.json` — added oidc build command
- `tsconfig.base.json` — added path mappings for both sub-packages
- `package.json` (root) — added `oidc-provider@^9.7.0` dependency
- `apps/demo-api/src/app/app.module.ts` — imported DemoApiOAuthModule
- `apps/demo-api/src/app/common/firebase/index.ts` — added oauth.module export

### Reference (read-only)
- `packages/firebase-server/mailgun/` — sub-package pattern template (rollup)
- `packages/dbx-form/mapbox/` — sub-package pattern template (Angular/ng-packagr)
- `packages/firebase-server/src/lib/firestore/snapshot/snapshot.field.ts` — encrypted field (Phase 1)
- `packages/firebase-server/src/lib/nest/middleware/appcheck.middleware.ts` — middleware pattern
- `packages/firebase-server/src/lib/nest/middleware/appcheck.module.ts` — middleware module pattern
- `packages/firebase-server/src/lib/nest/auth/auth.module.ts` — `FIREBASE_AUTH_TOKEN` DI pattern
- `packages/firebase-server/src/lib/nest/app.ts` — `nestServerInstance()` middleware wiring
