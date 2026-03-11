# @dereekb/firebase-server JSDoc Improvement Plan

## Context

The `@dereekb/firebase-server` package provides the server-side Firebase integration layer: NestJS modules, Cloud Functions wiring, Firestore drivers, auth services, middleware, and model action services for notification and storage-file workflows. Better JSDoc coverage improves AI comprehension and developer onboarding.

Gold standard JSDoc reference: `packages/firebase/src/lib/common/firestore/snapshot/snapshot.ts`
Server action cross-reference: `packages/firebase/src/lib/model/notification/notification.ts` (client-side model types)

---

## Checklist

### Phase 1: Core Library — Auth, Env, Type (`packages/firebase-server/src/lib/`)

Small foundational modules. Quick wins.

#### 1A. Auth
- [x] `auth/auth.context.ts` — Document `FirebaseServerAuthContext` interface and factory; explain how it wraps Firebase Admin Auth
- [x] `auth/auth.service.error.ts` — Verify existing JSDoc on error classes; add cross-references to `auth.service.ts`
- [x] `auth/auth.service.ts` — Large file; audit existing JSDoc coverage; add missing documentation on exported functions/classes; add `@example` blocks on key service methods
- [x] `auth/auth.util.ts` — Verify existing JSDoc; add `@example` if missing

#### 1B. Env & Type
- [x] `env/env.config.ts` — Verify existing JSDoc; add `@example` for config factory
- [x] `env/env.service.ts` — Verify existing JSDoc on abstract class
- [x] `type.ts` — Verify existing JSDoc on exported types

#### 1C. Verify
- [x] Run `pnpm nx run firebase-server:build-base` to confirm no build errors

---

### Phase 2: Core Library — Firestore Drivers (`packages/firebase-server/src/lib/firestore/`)

Server-side Firestore driver implementations bridging the abstract driver interfaces from `@dereekb/firebase`.

#### 2A. Driver implementations
- [x] `driver.ts` — Document server Firestore driver factory; cross-reference `@dereekb/firebase` driver abstraction
- [x] `driver.accessor.ts` — Document accessor creation functions; explain relationship to abstract accessors
- [x] `driver.accessor.default.ts` — Document default accessor; add `@example`
- [x] `driver.accessor.batch.ts` — Document batch accessor and write batching semantics
- [x] `driver.accessor.transaction.ts` — Document transaction accessor and retry semantics
- [x] `driver.query.ts` — Document server query driver implementation

#### 2B. Utilities
- [x] `firestore.ts` — Verify existing JSDoc
- [x] `array.ts` — Verify existing JSDoc on array operations
- [x] `increment.ts` — Verify existing JSDoc on increment operations
- [x] `snapshot/snapshot.field.encrypt.ts` — Verify existing comprehensive JSDoc; ensure `@example` blocks are present for encrypted field factories

#### 2C. Verify
- [x] Run `pnpm nx run firebase-server:build-base` to confirm no build errors

---

### Phase 3: Core Library — Function & Storage (`packages/firebase-server/src/lib/`)

Cloud Functions types and storage driver implementations.

#### 3A. Function module
- [x] `function/assert.ts` — Verify existing JSDoc on assertion functions
- [x] `function/context.ts` — Document function context types
- [x] `function/error.auth.ts` — Document auth error types
- [x] `function/error.ts` — Verify existing comprehensive JSDoc; add missing `@example` blocks
- [x] `function/type.ts` — Verify existing JSDoc

#### 3B. Storage module
- [x] `storage/driver.ts` — Document server storage driver factory
- [x] `storage/driver.accessor.ts` — Audit existing JSDoc; add missing documentation on GCS accessor methods
- [x] `storage/storage.service.ts` — Verify existing JSDoc on service interface/class
- [x] `storage/storage.ts` — Verify existing JSDoc

#### 3C. Verify
- [x] Run `pnpm nx run firebase-server:build-base` to confirm no build errors

---

### Phase 4: NestJS — App, Providers, Auth (`packages/firebase-server/src/lib/nest/`)

Core NestJS application bootstrap and auth modules.

#### 4A. App bootstrap
- [x] `app.ts` — Audit existing substantial JSDoc; add missing `@example` blocks for app factory functions
- [x] `nest.provider.ts` — Audit existing JSDoc on provider classes/tokens
- [x] `nest.provider.server.ts` — Verify existing JSDoc

#### 4B. Auth module
- [x] `auth/auth.module.ts` — Audit existing JSDoc on NestJS auth module configuration
- [x] `auth/auth.util.ts` — Document 6 utility functions for auth token extraction/validation

#### 4C. Env & Firebase modules
- [x] `env/env.service.ts` — Document NestJS environment service
- [x] `env/env.util.ts` — Document environment utility functions
- [x] `firebase/firebase.module.ts` — Document Firebase NestJS module registration

#### 4D. Verify
- [x] Run `pnpm nx run firebase-server:build-base` to confirm no build errors

---

### Phase 5: NestJS — Firestore, Storage, Middleware (`packages/firebase-server/src/lib/nest/`)

NestJS module wiring for Firestore, storage, and HTTP middleware.

#### 5A. Firestore & Storage modules
- [x] `firestore/firestore.module.ts` — Audit existing JSDoc on module providers and tokens
- [x] `storage/storage.module.ts` — Audit existing JSDoc on storage module configuration

#### 5B. Middleware
- [x] `middleware/appcheck.decorator.ts` — Document AppCheck decorator usage with `@example`
- [x] `middleware/appcheck.middleware.ts` — Audit existing JSDoc; add cross-reference to middleware module
- [x] `middleware/appcheck.module.ts` — Audit existing JSDoc
- [x] `middleware/appcheck.ts` — Document AppCheck interface
- [x] `middleware/globalprefix.ts` — Verify existing JSDoc on abstract class
- [x] `middleware/rawbody.middleware.ts` — Document raw body middleware purpose (webhook signature verification)
- [x] `middleware/webhook.module.ts` — Verify existing JSDoc

#### 5C. Verify
- [x] Run `pnpm nx run firebase-server:build-base` to confirm no build errors

---

### Phase 6: NestJS — Function Wrappers (`packages/firebase-server/src/lib/nest/function/`)

NestJS integration for Firebase Cloud Functions v1 and v2.

#### 6A. V1 function wrappers
- [ ] `function/call.ts` — Audit existing JSDoc on callable function factories
- [ ] `function/context.ts` — Verify existing JSDoc
- [ ] `function/nest.ts` — Document NestJS function integration helpers
- [ ] `function/schedule.ts` — Audit existing JSDoc on schedule function interfaces

#### 6B. V2 function wrappers
- [ ] `function/v2/blocking.ts` — Document blocking function wrappers (beforeCreate, beforeSignIn, etc.)
- [ ] `function/v2/call.ts` — Audit existing JSDoc on v2 callable types
- [ ] `function/v2/event.ts` — Audit existing JSDoc on event-triggered function wrappers
- [ ] `function/v2/schedule.ts` — Audit existing JSDoc on v2 schedule wrappers
- [ ] `function/v2/taskqueue.ts` — Audit existing JSDoc on task queue function wrapper

#### 6C. Verify
- [ ] Run `pnpm nx run firebase-server:build-base` to confirm no build errors

---

### Phase 7: NestJS — Model CRUD & Development (`packages/firebase-server/src/lib/nest/`)

Model function factories and development utilities.

#### 7A. Model CRUD functions
- [ ] `model/api.details.ts` — Audit existing comprehensive JSDoc; verify `@example` blocks
- [ ] `model/call.model.function.ts` — Audit existing JSDoc on model call function factories
- [ ] `model/create.model.function.ts` — Audit existing JSDoc on model create factories
- [ ] `model/crud.assert.function.ts` — Document CRUD assertion utilities
- [ ] `model/delete.model.function.ts` — Document model delete function factory with `@example`
- [ ] `model/permission.error.ts` — Document permission error types
- [ ] `model/read.model.function.ts` — Document model read function factory with `@example`
- [ ] `model/specifier.function.ts` — Audit existing JSDoc
- [ ] `model/update.model.function.ts` — Document model update function factory with `@example`

#### 7B. Development utilities
- [ ] `development/development.app.function.ts` — Audit existing JSDoc
- [ ] `development/development.assert.function.ts` — Document development assertion functions
- [ ] `development/development.function.ts` — Audit existing JSDoc
- [ ] `development/development.schedule.function.error.ts` — Audit existing JSDoc on error functions
- [ ] `development/development.schedule.function.ts` — Document development schedule function wrappers

#### 7C. Verify
- [ ] Run `pnpm nx run firebase-server:build-base` to confirm no build errors

---

### Phase 8: Model Sub-Package — Notification (`packages/firebase-server/model/src/lib/notification/`)

The largest and most complex module. Server-side notification action services, send pipelines, and task handlers.

#### 8A. Core action services
- [ ] `notification.action.service.ts` — (~1,942 lines) Document the main notification action service; explain each action method's purpose, inputs, and flow; cross-reference `@dereekb/firebase` notification types; add `@example` blocks for key actions
- [ ] `notification.action.init.service.ts` — (~347 lines) Document initialization service; explain how it wires notification actions into the CRUD system

#### 8B. Configuration & errors
- [ ] `notification.config.ts` — Document injection tokens and configuration interfaces
- [ ] `notification.config.service.ts` — Audit existing JSDoc on config service
- [ ] `notification.error.ts` — Document all 6 error classes with when they're thrown
- [ ] `notification.module.ts` — Audit existing JSDoc on NestJS module

#### 8C. Send pipeline
- [ ] `notification.send.ts` — Document send type exports
- [ ] `notification.send.service.ts` — Document send service orchestration; explain channel routing
- [ ] `notification.send.service.notificationsummary.ts` — Document summary notification send logic
- [ ] `notification.send.service.text.ts` — Document text/SMS send service
- [ ] `notification.create.run.ts` — Document notification creation run logic

#### 8D. Task system
- [ ] `notification.task.service.ts` — Document task service entry point
- [ ] `notification.task.service.handler.ts` — Document task handler dispatch logic
- [ ] `notification.task.service.util.ts` — Document task utility functions
- [ ] `notification.task.subtask.handler.ts` — (~542 lines) Document subtask handler; explain checkpoint-based async workflow

#### 8E. Utilities & expedite
- [ ] `notification.expedite.service.ts` — Document expedite service for priority notification processing
- [ ] `notification.util.ts` — (~756 lines) Document all utility functions; explain recipient expansion, config resolution, template building

#### 8F. Verify
- [ ] Run `pnpm nx run firebase-server-model:test` to confirm no test breakage
- [ ] Run `pnpm nx run firebase-server-model:build-base` to confirm no build errors

---

### Phase 9: Model Sub-Package — StorageFile (`packages/firebase-server/model/src/lib/storagefile/`)

Server-side storage file action services, upload pipeline, and task handlers.

#### 9A. Core action services
- [ ] `storagefile.action.server.ts` — (~1,137 lines) Document server action service; explain each action method; cross-reference `@dereekb/firebase` storagefile types
- [ ] `storagefile.action.init.service.ts` — (~245 lines) Document initialization service and CRUD wiring

#### 9B. Upload pipeline
- [ ] `storagefile.upload.service.ts` — Document upload service entry point
- [ ] `storagefile.upload.service.initializer.ts` — (~344 lines) Document upload initializer; explain file type routing and validation

#### 9C. Tasks, errors, utilities
- [ ] `storagefile.task.service.handler.ts` — (~536 lines) Document task handler for file processing workflows
- [ ] `storagefile.error.ts` — Document all 5 error classes
- [ ] `storagefile.module.ts` — Audit existing JSDoc
- [ ] `storagefile.util.ts` — Document utility functions

#### 9D. Verify
- [ ] Run `pnpm nx run firebase-server-model:test` to confirm no test breakage
- [ ] Run `pnpm nx run firebase-server-model:build-base` to confirm no build errors

---

### Phase 10: Model Sub-Package — Mailgun (`packages/firebase-server/model/src/lib/mailgun/`)

#### 10A. Mailgun notification integration
- [ ] `notification.send.service.mailgun.ts` — Audit existing JSDoc; add cross-references to notification send pipeline

#### 10B. Verify
- [ ] Run `pnpm nx run firebase-server-model:build-base` to confirm no build errors

---

### Phase 11: Mailgun Sub-Package (`packages/firebase-server/mailgun/src/lib/`)

#### 11A. Auth integration
- [ ] `auth.mailgun.ts` — Audit existing JSDoc; add `@example` for webhook verification setup

#### 11B. Verify
- [ ] Run `pnpm nx run firebase-server-mailgun:build-base` to confirm no build errors

---

### Phase 12: Zoho Sub-Package (`packages/firebase-server/zoho/src/lib/`)

#### 12A. Zoho integration
- [ ] `zoho.accounts.firebase.system.ts` — Document Zoho accounts system integration
- [ ] `zoho.accounts.firebase.ts` — Document Zoho accounts Firebase bridge

#### 12B. Verify
- [ ] Run `pnpm nx run firebase-server-zoho:build-base` to confirm no build errors

---

### Phase 13: OIDC Sub-Package (`packages/firebase-server/oidc/src/lib/`)

New OIDC provider module. Currently has zero JSDoc coverage.

#### 13A. Configuration & module
- [ ] `oidc.config.ts` — Document OIDC configuration interfaces and injection tokens
- [ ] `oidc.module.ts` — Document NestJS OIDC module registration and configuration

#### 13B. Model — Adapter
- [ ] `model/model.ts` — Document OIDC model type definitions
- [ ] `model/adapter/adapter.ts` — Document Firestore adapter for oidc-provider; explain how it implements the oidc-provider Adapter interface
- [ ] `model/adapter/adapter.id.ts` — Document adapter ID generation
- [ ] `model/adapter/adapter.query.ts` — Document adapter query helpers

#### 13C. Model — JWKS
- [ ] `model/jwks/jwks.ts` — Document JWKS key model; explain key lifecycle (active → rotated → retired)
- [ ] `model/jwks/jwks.id.ts` — Document JWKS key ID generation
- [ ] `model/jwks/jwks.query.ts` — Document JWKS query helpers

#### 13D. Services
- [ ] `service/oidc.service.ts` — Document main OIDC service
- [ ] `service/oidc.config.service.ts` — Document OIDC configuration service; explain provider setup
- [ ] `service/adapter.service.ts` — Document adapter service wrapping Firestore adapter
- [ ] `service/jwks.service.ts` — Document JWKS key management service; explain rotation and GCS publishing
- [ ] `service/account.service.ts` — Document findAccount bridge to Firebase Auth
- [ ] `service/account.ts` — Document account interface types

#### 13E. Controllers
- [ ] `controller/interaction.controller.ts` — Document OIDC interaction flow controller (login/consent)
- [ ] `controller/provider.controller.ts` — Document provider route controller
- [ ] `controller/wellknown.controller.ts` — Document well-known endpoint controller

#### 13F. Middleware
- [ ] `middleware/oauth-auth.middleware.ts` — Document OAuth bearer token middleware
- [ ] `middleware/oauth-auth.module.ts` — Document OAuth auth NestJS module

#### 13G. Verify
- [ ] Run `pnpm nx run firebase-server-oidc:build-base` to confirm no build errors

---

## Guidelines

### JSDoc Standards
- Follow TSDoc standards and `dbc__note__typescript-jsdocs` conventions
- Explain **why** (purpose, when to use), not just **what**
- Add `@example` blocks on factory functions, service methods, and key configuration types
- Use `{@link TypeName}` cross-references to related types in `@dereekb/firebase` and other packages
- Document NestJS injection tokens with their purpose and typical usage
- For large action services, document the overall flow before individual methods

### What NOT to do
- Don't rewrite implementation code
- Don't add JSDoc to test files or `index.ts` barrels
- Don't add JSDoc to non-exported internal helpers
- Don't add comments that just restate the type name
