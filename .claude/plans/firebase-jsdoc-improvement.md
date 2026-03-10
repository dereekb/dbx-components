# @dereekb/firebase JSDoc Improvement Plan

## Context

The `@dereekb/firebase` package is the core Firebase integration layer. It defines data models, Firestore patterns, and API types consumed by all downstream packages and apps. Better JSDoc coverage improves AI comprehension, developer onboarding, and understanding of how models connect to server actions and API endpoints.

Planning doc: `~/.claude/cloud-sync/planning/dbx-components/firebase-jsdoc-improvement.md`

Gold standard JSDoc reference: `packages/firebase/src/lib/common/firestore/snapshot/snapshot.ts`

---

## Checklist

### Phase 1: Notification Model (`packages/firebase/src/lib/model/notification/`)

The most complex model — 5 Firestore document types, multi-channel messaging, task workflows, bitwise config.

#### 1A. Core types and enums
- [x] `notification.ts` — Audit existing JSDoc on NotificationUser, NotificationSummary, NotificationBox, Notification, NotificationWeek; add cross-references to server action service; document field abbreviations (e.g., `bc`, `gc`, `dc`, `r`, `w`, `sat`); add module-level overview JSDoc; document the state enums (NotificationSendState, NotificationSendType) with transition descriptions
- [x] `notification.id.ts` — Document ID generation patterns; explain two-way flat model key usage and why it's used for reverse lookup; add examples for `notificationBoxIdForModel()`, `notificationSummaryIdForModel()`

#### 1B. Item, message, and send types
- [x] `notification.item.ts` — Document NotificationItem embedding pattern; explain the `d` metadata field typing; document `unreadNotificationItems()` usage
- [x] `notification.message.ts` — Document the message function factory pattern (`notificationMessageFunction()`); explain NotificationMessageFunctionExtras (globalRecipients, onSendAttempted, onSendSuccess callbacks); document NotificationMessageFlag enum; add example of creating a message function
- [x] `notification.send.ts` — Document result types for each channel (email, text, summary); explain success/failed/ignored semantics

#### 1C. Configuration and encoding
- [x] `notification.config.ts` — Document the bitwise encoding system for NotificationBoxRecipientTemplateConfig; explain the 3-level configuration hierarchy (template defaults → global user config → per-box config); document `effectiveNotificationBoxRecipientConfig()` resolution logic; add examples of encoding/decoding
- [x] `notification.details.ts` — Document NotificationTemplateTypeInfo and its role in the template system; explain `onlySendToExplicitlyEnabledRecipients` semantics; document the info record service pattern

#### 1D. Task and checkpoint system
- [x] `notification.task.ts` — Document the checkpoint-based async task workflow; explain completion semantics (true/false/string[]); document helper functions (`notificationTaskComplete()`, `notificationTaskFailed()`, `notificationTaskDelayRetry()`); add example of a multi-step task
- [x] `notification.task.subtask.ts` — Document subtask completion tracking and its relationship to the parent task

#### 1E. Creation, queries, and API
- [x] `notification.create.ts` — Document CreateNotificationTemplate and input patterns; explain the relationship between creation templates and the send system
- [x] `notification.create.task.ts` — Document task creation templates
- [x] `notification.query.ts` — Document each query helper function's purpose and when it's used by the server action service
- [x] `notification.api.ts` — Document the Arktype validation pattern; document the abstract NotificationFunctions class and CRUD config map; add cross-reference to demo-api function endpoints
- [x] `notification.api.util.ts` — Document API utility functions
- [x] `notification.api.error.ts` — Document error types and when they're thrown

#### 1F. Action types and utilities
- [x] `notification.action.ts` — Document the generic action type pattern (sync/async variants); explain how these types connect to firebase-server action factories
- [x] `notification.util.ts` — Document utility functions including `expandNotificationRecipients()`, `updateNotificationUserNotificationBoxRecipientConfig()`, `makeNewNotificationSummaryTemplate()`

#### 1G. Verify
- [x] Run `pnpm nx run firebase:build-base` to confirm no build errors from JSDoc changes

---

### Phase 2: StorageFile Model (`packages/firebase/src/lib/model/storagefile/`)

Simpler model with file state machines, upload lifecycle, and group management.

#### 2A. Core types
- [x] `storagefile.ts` — Audit existing JSDoc; document state machine transitions for StorageFileState and StorageFileProcessingState; document field abbreviations; add module-level overview with lifecycle diagram reference
- [x] `storagefile.id.ts` — Document ID patterns; explain StorageFileGroupCreatedStorageFileKey

#### 2B. File operations
- [x] `storagefile.file.ts` — Document StoredFileReader interface and lazy-loading pattern; document `storedFileReaderFactory()` with example
- [x] `storagefile.upload.ts` — Document the upload folder path convention; explain upload type identifiers and how they route to initializers; document result enum values
- [x] `storagefile.upload.claims.ts` — Document upload claims types
- [x] `storagefile.upload.determiner.ts` — Document the upload type determination pattern

#### 2C. Groups and processing
- [x] `storagefile.group.ts` — Document StorageFileGroup embedding pattern; explain zip generation path convention
- [x] `storagefile.group.processing.ts` — Document group processing types
- [x] `storagefile.task.ts` — Document storage file task types

#### 2D. Queries, API, and utilities
- [x] `storagefile.query.ts` — Document each query function and when it's used
- [x] `storagefile.api.ts` — Document API parameter types with Arktype validation pattern
- [x] `storagefile.api.error.ts` — Document error types (already adequate)
- [x] `storagefile.action.ts` — Document action type aliases
- [x] `storagefile.create.ts` — Document creation patterns
- [x] `storagefile.permission.ts` — Document `grantStorageFileRolesForUserAuthFunction()` and role semantics
- [x] `storagefile.util.ts` — Document utility functions including `calculateStorageFileGroupEmbeddedFileUpdate()`, `calculateStorageFileGroupRegeneration()`

#### 2E. Remaining models
- [x] `system/system.ts` — Document SystemState singleton pattern and generic stored data
- [x] `system/system.action.ts` — Document system action types
- [x] `user.ts` — Document UserRelated and UserRelatedById (likely already adequate)

#### 2F. Verify
- [x] Run `pnpm nx run firebase:build-base` to confirm no build errors

---

### Phase 3: Common Firestore Infrastructure (`packages/firebase/src/lib/common/firestore/`)

The foundational layer all models depend on. ~30 source files across 6 sub-modules.

#### 3A. Snapshot converters
- [x] `snapshot/snapshot.ts` — Already excellent; verify examples are current
- [x] `snapshot/snapshot.type.ts` — Document snapshot type utilities
- [x] `snapshot/snapshot.field.ts` — Document field-level converters; explain `dontStoreIf` optimization; document each field converter type with examples

#### 3B. Document accessors
- [x] `accessor/accessor.ts` — Document core FirestoreDocumentDataAccessor interface and CRUD methods
- [x] `accessor/accessor.default.ts` — Document default accessor implementation
- [x] `accessor/accessor.batch.ts` — Document batch accessor for bulk writes
- [x] `accessor/accessor.transaction.ts` — Document transaction accessor
- [x] `accessor/accessor.wrap.ts` — Document accessor wrapping pattern
- [x] `accessor/accessor.wrap.modify.ts` — Document modify-on-write wrapper
- [x] `accessor/context.ts` — Document FirestoreDocumentAccessorContext and factory pattern
- [x] `accessor/context.default.ts`, `context.batch.ts`, `context.transaction.ts` — Document each context variant
- [x] `accessor/converter.ts` — Document converter accessor
- [x] `accessor/document.ts` — Document FirestoreDocument interface and its role
- [x] `accessor/document.rxjs.ts` — Document reactive document streaming
- [x] `accessor/document.utility.ts` — Document utility functions for documents
- [x] `accessor/increment.ts` — Document increment operations
- [x] `accessor/array.ts` — Document array accessor utilities

#### 3C. Collections
- [x] `collection/collection.ts` — Document FirestoreCollection interface and hierarchy
- [x] `collection/collection.group.ts` — Document collection group querying
- [x] `collection/collection.key.ts` — Document key generation
- [x] `collection/collection.query.ts` — Document collection query interface
- [x] `collection/collection.single.ts` — Document single-document collection pattern
- [x] `collection/collection.util.ts` — Document collection utilities
- [x] `collection/subcollection.ts` — Document subcollection definition pattern
- [x] `collection/subcollection.single.ts` — Document single-document subcollection

#### 3D. Query system
- [x] `query/query.ts` — Document query building interface
- [x] `query/constraint.ts` — Document constraint types for building queries
- [x] `query/constraint.template.ts` — Document constraint templates
- [x] `query/iterator.ts` — Document query iteration pattern
- [x] `query/query.iterate.ts` — Document paginated query iteration
- [x] `query/query.iterate.array.ts` — Document array-based iteration
- [x] `query/accumulator.ts` — Document query result accumulation
- [x] `query/watcher.ts` — Document query watching/streaming
- [x] `query/query.util.ts` — Document query utilities

#### 3E. Supporting modules
- [x] `driver/driver.ts` — Document the Firestore driver abstraction
- [x] `driver/accessor.ts`, `batch.ts`, `transaction.ts`, `query.ts`, `query.handler.ts` — Document each driver component
- [x] `context.ts` — Document FirestoreContext
- [x] `reference.ts` — Document reference utilities
- [x] `types.ts` — Document shared Firestore types
- [x] `error.ts` — Document Firestore error types
- [x] `util/id.batch.ts` — Document batch ID generation

#### 3F. Verify
- [x] Run `pnpm nx run firebase:build-base` to confirm no build errors

---

### Phase 4: Common Storage, Auth, Function, and Model (`packages/firebase/src/lib/common/` non-firestore)

#### 4A. Storage
- [x] `storage/storage.ts` — Document StoragePath and related types
- [x] `storage/types.ts` — Document storage type definitions
- [x] `storage/context.ts` — Document StorageContext
- [x] `storage/accessor/path.model.ts` — Document model-aware storage paths
- [x] `storage/driver/driver.ts` — Document storage driver abstraction
- [x] `storage/driver/accessor.ts` — Document storage accessor driver
- [x] `storage/driver/accessor.util.ts` — Document accessor utilities
- [x] `storage/driver/accessor.iterate.ts` — Document iteration pattern
- [x] `storage/driver/list.ts` — Document list operations
- [x] `storage/driver/error.ts` — Document storage errors

#### 4B. Auth
- [x] `auth/auth.ts` — Document auth types and constants
- [x] `auth/auth.context.ts` — Document auth context
- [x] `auth/auth.error.ts` — Document client auth errors
- [x] `auth/auth.server.error.ts` — Document server auth errors

#### 4C. Function and model utilities
- [x] `function/action.ts` — Document function action types
- [x] `model/context.ts` — Document model context
- [x] `model/function.ts` — Document model function types
- [x] `model/model.service.ts` — Document model service
- [x] `model/model/model.loader.ts` — Document model loader
- [x] `model/model/model.param.ts` — Document model parameters
- [x] `model/model/model.validator.ts` — Document model validator (already adequate)
- [x] `model/permission/permission.ts` — Document permission types
- [x] `model/permission/permission.context.ts` — Document permission context
- [x] `model/permission/permission.service.ts` — Document permission service
- [x] `model/permission/permission.service.grant.ts` — Document grant service
- [x] `model/permission/permission.service.role.ts` — Document role service
- [x] `development/function.ts` — Document development function utilities
- [x] `development/function.schedule.ts` — Document schedule utilities
- [x] `error.ts` — Document common error types (already adequate)

#### 4D. Verify
- [x] Run `pnpm nx run firebase:build-base` to confirm no build errors

---

### Phase 5: Client Implementations (`packages/firebase/src/lib/client/`)

Lowest priority — these implement common interfaces.

- [x] Audit `client/firestore/` files for JSDoc gaps
- [x] Audit `client/storage/` files for JSDoc gaps
- [x] Audit `client/function/` files for JSDoc gaps
- [x] Audit `client/error/` files for JSDoc gaps
- [x] Add missing JSDoc where needed
- [x] Run `pnpm nx run firebase:build-base` to confirm no build errors

---

## Guidelines

### JSDoc Standards
- Follow TSDoc standards and `dbc__note__typescript-jsdocs` conventions
- Explain **why** (purpose, when to use), not just **what**
- Add `@example` blocks on factory functions and key configuration types
- Use cross-references (e.g., "See {@link NotificationServerActions} in `@dereekb/firebase-server/model` for server-side handling")
- Document field abbreviations on Firestore interfaces (e.g., `/** Box configs. Array of per-NotificationBox recipient configs for this user. */`)

### What NOT to do
- Don't rewrite implementation code
- Don't add JSDoc to test files or `index.ts` barrels
- Don't add JSDoc to non-exported internal helpers
- Don't add comments that just restate the type name
