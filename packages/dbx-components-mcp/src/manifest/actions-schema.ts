/**
 * Arktype schemas for the actions manifest format.
 *
 * Manifests are JSON files that catalog the @dereekb/dbx-core action
 * surface — the directive stack that wires a `dbxAction` context, the
 * `ActionContextStore` ComponentStore, and the `DbxActionState` enum
 * members. One manifest per source — bundled `@dereekb/*` packages plus
 * any downstream-app manifests discovered via `dbx-mcp.config.json` —
 * feeds the merged registry that powers the `dbx_action_lookup` MCP tool.
 *
 * Three entry shapes share a slug index but differ in payload:
 *
 *   - `directive` — Angular directive that contributes to a dbxAction context
 *   - `store`     — the canonical NgRx ComponentStore
 *   - `state`     — a single member of the `DbxActionState` enum
 *
 * The schemas in this module are the *contract* — once a downstream app
 * commits a manifest file, breaking changes here mean every downstream
 * regenerates.
 */

import { type } from 'arktype';

// MARK: Vocabularies
/**
 * Three roles that share a slug index but differ in payload.
 */
export const ACTION_ENTRY_ROLES = ['directive', 'store', 'state'] as const;

/**
 * Static type for the closed role vocabulary.
 */
export type ActionEntryRoleValue = (typeof ACTION_ENTRY_ROLES)[number];

/**
 * The seven members of `DbxActionState`. Mirrors the source enum — kept as a
 * closed vocabulary so the manifest schema can validate state-entry slugs
 * against the canonical set.
 */
export const DBX_ACTION_STATE_VALUES = ['IDLE', 'DISABLED', 'TRIGGERED', 'VALUE_READY', 'WORKING', 'RESOLVED', 'REJECTED'] as const;

/**
 * Static type for the closed state-value vocabulary.
 */
export type DbxActionStateValue = (typeof DBX_ACTION_STATE_VALUES)[number];

// MARK: Shared sub-shapes
/**
 * One input on a directive — alias, property, type, required flag, default,
 * description.
 */
export const ActionInputEntry = type({
  alias: 'string',
  propertyName: 'string',
  type: 'string',
  required: 'boolean',
  description: 'string',
  'defaultValue?': 'string'
});

/**
 * Static type inferred from {@link ActionInputEntry}.
 */
export type ActionInputEntry = typeof ActionInputEntry.infer;

/**
 * One output / event emitter on a directive.
 */
export const ActionOutputEntry = type({
  name: 'string',
  type: 'string',
  description: 'string'
});

/**
 * Static type inferred from {@link ActionOutputEntry}.
 */
export type ActionOutputEntry = typeof ActionOutputEntry.infer;

/**
 * One method on the store. `signature` is the full method signature string
 * (`setIsModified(value: boolean): void`) so callers can render the API
 * surface without reassembling parameter pieces.
 */
export const ActionStoreMethodEntry = type({
  name: 'string',
  signature: 'string',
  description: 'string'
});

/**
 * Static type inferred from {@link ActionStoreMethodEntry}.
 */
export type ActionStoreMethodEntry = typeof ActionStoreMethodEntry.infer;

/**
 * One public observable on the store.
 */
export const ActionStoreObservableEntry = type({
  name: 'string',
  type: 'string',
  description: 'string'
});

/**
 * Static type inferred from {@link ActionStoreObservableEntry}.
 */
export type ActionStoreObservableEntry = typeof ActionStoreObservableEntry.infer;

// MARK: Entry — directive
/**
 * Directive entry. Captures selector + class + DI behavior + the action
 * states the directive reads/writes.
 */
export const ActionDirectiveEntry = type({
  role: '"directive"',
  slug: 'string',
  selector: 'string',
  className: 'string',
  module: 'string',
  description: 'string',
  skillRefs: 'string[]',
  sourcePath: 'string',
  inputs: ActionInputEntry.array(),
  outputs: ActionOutputEntry.array(),
  producesContext: 'boolean',
  consumesContext: 'boolean',
  stateInteraction: '("IDLE" | "DISABLED" | "TRIGGERED" | "VALUE_READY" | "WORKING" | "RESOLVED" | "REJECTED")[]',
  example: 'string',
  'sourceLocation?': type({ file: 'string', line: 'number' }),
  'deprecated?': 'boolean | string',
  'since?': 'string'
});

/**
 * Static type inferred from {@link ActionDirectiveEntry}.
 */
export type ActionDirectiveEntry = typeof ActionDirectiveEntry.infer;

// MARK: Entry — store
/**
 * Store entry. Captures the class metadata plus the public API surface
 * (methods + observables) and the standard `disabledKey` constants.
 */
export const ActionStoreEntry = type({
  role: '"store"',
  slug: 'string',
  className: 'string',
  module: 'string',
  description: 'string',
  skillRefs: 'string[]',
  sourcePath: 'string',
  methods: ActionStoreMethodEntry.array(),
  observables: ActionStoreObservableEntry.array(),
  disabledKeyDefaults: 'string[]',
  example: 'string',
  'sourceLocation?': type({ file: 'string', line: 'number' }),
  'deprecated?': 'boolean | string',
  'since?': 'string'
});

/**
 * Static type inferred from {@link ActionStoreEntry}.
 */
export type ActionStoreEntry = typeof ActionStoreEntry.infer;

// MARK: Entry — state
/**
 * State entry. Captures one `DbxActionState` enum member with explicit
 * transition arrows.
 */
export const ActionStateEntry = type({
  role: '"state"',
  slug: 'string',
  enumName: 'string',
  stateValue: '"IDLE" | "DISABLED" | "TRIGGERED" | "VALUE_READY" | "WORKING" | "RESOLVED" | "REJECTED"',
  literal: 'string',
  module: 'string',
  description: 'string',
  skillRefs: 'string[]',
  sourcePath: 'string',
  transitionsFrom: '("IDLE" | "DISABLED" | "TRIGGERED" | "VALUE_READY" | "WORKING" | "RESOLVED" | "REJECTED")[]',
  transitionsTo: '("IDLE" | "DISABLED" | "TRIGGERED" | "VALUE_READY" | "WORKING" | "RESOLVED" | "REJECTED")[]',
  example: 'string',
  'sourceLocation?': type({ file: 'string', line: 'number' }),
  'deprecated?': 'boolean | string',
  'since?': 'string'
});

/**
 * Static type inferred from {@link ActionStateEntry}.
 */
export type ActionStateEntry = typeof ActionStateEntry.infer;

// MARK: Discriminated union
/**
 * One action manifest entry, discriminated on `role`.
 */
export const ActionEntry = ActionDirectiveEntry.or(ActionStoreEntry).or(ActionStateEntry);

/**
 * Static type inferred from {@link ActionEntry}.
 */
export type ActionEntry = typeof ActionEntry.infer;

// MARK: Manifest
/**
 * Top-level manifest envelope. One file per source.
 */
export const ActionManifest = type({
  version: '1',
  source: 'string',
  module: 'string',
  generatedAt: 'string',
  generator: 'string',
  entries: ActionEntry.array()
});

/**
 * Static type inferred from {@link ActionManifest}.
 */
export type ActionManifest = typeof ActionManifest.infer;
