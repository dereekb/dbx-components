/**
 * Model archetype catalog.
 *
 * Canonical metadata for the 17 Firestore-model archetypes plus 3 field-level
 * add-ons that the `dbx_model_archetype_*` tool cluster recommends, looks up,
 * and filters peers by. Pure data — no imports, no state — so it can be
 * consumed from tools, resources, and tests without bootstrap overhead.
 *
 * Each archetype carries its `slug`, the implied
 * {@link FirestoreCollectionKind}, a short narrative description, a structured
 * "answer template" (`expected`) used by the recommender's scoring algorithm,
 * the discrete axis values that further refine the slug, and any v1/v2
 * `aliases` so callers passing legacy slugs still resolve to a v3 successor.
 *
 * The recommender's scoring algorithm walks {@link MODEL_ARCHETYPES} once per
 * call and never mutates the array, so the entire table is frozen at
 * compile-time through `readonly` types. New archetypes are added by appending
 * a {@link ModelArchetypeInfo} entry — the tool cluster picks it up
 * automatically.
 */

import type { FirestoreCollectionKind } from './firebase-models.js';

// MARK: Sync mode

/**
 * First-class sync-mode taxonomy attached to every model archetype. Mirrors the
 * vocabulary documented in the planning doc (`§3 Sync-Mode Vocabulary`) so the
 * recommender's questionnaire, the catalog UI, and the heuristic extractor all
 * use one set of values.
 *
 * - `always-in-sync` – source of truth or updated synchronously alongside its dependency.
 * - `trigger-eventual` – patched by an `onWrite` / `onCreate` Firestore trigger.
 * - `flag-eventual` – source carries a `@dbxModelVariableSyncFlag` boolean flag walked by a scheduler.
 * - `scheduled-rebuild` – periodic full/partial rebuild on a cron; no per-source flag.
 * - `append-only` – never updated after creation; new docs supersede old.
 * - `pull-on-demand` – read by code when needed; nothing watches it.
 * - `external-bidirectional` – webhook patches in, scheduled reconciler patches out.
 */
export type ModelArchetypeSyncMode = 'always-in-sync' | 'trigger-eventual' | 'flag-eventual' | 'scheduled-rebuild' | 'append-only' | 'pull-on-demand' | 'external-bidirectional';

/**
 * Every recognised sync-mode in declaration order. Exported so resources can
 * surface a stable list (`dbx://model-archetype/by-sync-mode/{mode}`) without
 * re-deriving it from {@link MODEL_ARCHETYPES}.
 */
export const MODEL_ARCHETYPE_SYNC_MODES: readonly ModelArchetypeSyncMode[] = ['always-in-sync', 'trigger-eventual', 'flag-eventual', 'scheduled-rebuild', 'append-only', 'pull-on-demand', 'external-bidirectional'];

// MARK: Doc id source / parent / user relation

/**
 * Discrete values for the `docIdSource` questionnaire field. Used both by the
 * recommender (top-tier discriminator, weight 3) and by the `denormalised-aggregate`
 * archetype's `keying` axis. Keep in sync with the canonical schema in
 * the planning doc (`§4.1`).
 */
export type ModelArchetypeDocIdSource = 'auto' | 'parent-id' | 'user-uid' | 'external-vendor-id' | 'geo-key' | 'bucket-code' | 'composite-flat-key' | 'numeric-short-id' | 'fixed';

/**
 * Discrete values for the `parentRelation` questionnaire field. Captures both
 * the structural parent (one / many parents, no parent) AND the meta-parent
 * cases the recommender uses to disambiguate user-keyed, external-id-keyed,
 * geo-key roots.
 */
export type ModelArchetypeParentRelation = 'none' | 'one-parent' | 'many-parents' | 'user-uid' | 'external-vendor-id' | 'region-key' | 'district-key' | 'composite-key';

/**
 * Discrete values for the `userRelation` questionnaire field. Independent of
 * {@link ModelArchetypeDocIdSource}: a model can have `uid-is-doc-id` AND a
 * field reference (`references-user-key`) in tandem.
 */
export type ModelArchetypeUserRelation = 'none' | 'owned-by-uid' | 'uid-is-doc-id' | 'references-user-key' | 'external-vendor-id-is-doc-id';

/**
 * Discrete values for the `mutability` questionnaire field. The `append-only`
 * case lives on `syncMode`, not here — once a doc is created it can still be
 * `mutable` or `immutable` across its lifetime independently.
 */
export type ModelArchetypeMutability = 'mutable' | 'immutable';

// MARK: Slugs

/**
 * Every recognised v3 archetype slug. Slugs collapse the v1/v2 catalog onto a
 * smaller set by promoting `axes` to first-class refinements rather than
 * separate slugs (see `single-item-sub.subPurpose`,
 * `denormalised-aggregate.keying`). The full migration table from v1/v2 is in
 * the planning doc (`§2.10`).
 */
export type ModelArchetypeSlug =
  | 'root-entity'
  | 'sub-collection-entity'
  | 'single-item-sub'
  | 'user-keyed-entity-root'
  | 'user-keyed-index-root'
  | 'external-id-keyed-entity-root'
  | 'geo-key-entity-root'
  | 'group-root'
  | 'group-member'
  | 'region-variant-root'
  | 'denormalised-aggregate'
  | 'root-singleton-aggregate'
  | 'external-mirror'
  | 'audit-log'
  | 'reference-registry'
  | 'geo-hierarchy-root'
  | 'system-state-singleton'
  | 'oidc-entry'
  | 'storagefile-purpose'
  | 'notification-template'
  | 'notification-task'
  | 'state-machine-field'
  | 'embedded-sub-objects'
  | 'active-vs-archive-split';

/**
 * Field-level add-on slugs that never appear as the primary archetype answer —
 * always returned alongside a "real" archetype on the recommender's "Field-level
 * add-ons" list.
 */
export const MODEL_ARCHETYPE_ADDON_SLUGS: readonly ModelArchetypeSlug[] = ['state-machine-field', 'embedded-sub-objects', 'active-vs-archive-split'];

// MARK: Axis values

/**
 * Discrete values for `single-item-sub.subPurpose`. Captures why this 1:1
 * subcollection exists — sensitive split, permission table, parent config,
 * parent state, denormalised summary, member-count summary.
 */
export type ModelArchetypeSingleItemSubPurpose = 'private' | 'permission' | 'config' | 'state' | 'summary' | 'member-summary';

/**
 * Discrete values for `denormalised-aggregate.keying`. Reproduces the four v1
 * variants (`digest`, `temporal-summary`, `sync-flagged-composition-index`,
 * subcollection `summary`) by combining `keying` with `syncMode`.
 */
export type ModelArchetypeDenormalisedAggregateKeying = 'parent-id' | 'bucket-code' | 'composite-flat-key' | 'numeric-short-id';

// MARK: Expected answer template

/**
 * Canonical answer template for one archetype. Each field is the *expected*
 * value the recommender looks for on a matching questionnaire; the scoring
 * algorithm sums weighted matches across these dimensions.
 *
 * Each property is optional because not every archetype constrains every
 * dimension — `root-entity` allows any `userRelation`, so its template omits
 * the field rather than forcing one value. Unset answers contribute zero to
 * the score on either side (see `§5.2 Scoring algorithm`).
 */
export interface ModelArchetypeExpectedAnswers {
  readonly docIdSource?: readonly ModelArchetypeDocIdSource[];
  readonly parentRelation?: readonly ModelArchetypeParentRelation[];
  readonly userRelation?: readonly ModelArchetypeUserRelation[];
  readonly syncMode?: readonly ModelArchetypeSyncMode[];
  readonly isDenormalization?: boolean;
  readonly isExternalMirror?: boolean;
  readonly isEventLog?: boolean;
  readonly hasInheritance?: boolean;
  readonly isSiblingAggregate?: boolean;
  readonly isSubsystemSingleton?: boolean;
  readonly involvesFileUpload?: boolean;
  readonly sendsMessageToUser?: boolean;
  readonly isMultiCheckpointWorkflow?: boolean;
  readonly hasLifecycleStates?: boolean;
  readonly hasSensitiveFields?: boolean;
  readonly needsFineGrainedPermissions?: boolean;
  readonly hasArchiveCounterpart?: boolean;
  readonly mutability?: readonly ModelArchetypeMutability[];
  readonly instancesPerParent?: readonly ('one' | 'many')[];
  readonly aggregatesFromNonEmpty?: boolean;
}

// MARK: Archetype info

/**
 * Catalog entry for one archetype. Shared by the recommender, lookup, search,
 * resource, and heuristic extractor so they all read from one source of truth.
 */
export interface ModelArchetypeInfo {
  readonly slug: ModelArchetypeSlug;
  /**
   * Family the archetype belongs to (`'standalone-entity'`, `'user-external-root'`, …).
   * Surfaced in the catalog group headers and `_lookup` output so users can see
   * sibling archetypes alongside the matched one.
   */
  readonly family: string;
  /**
   * Implied {@link FirestoreCollectionKind}. Some archetypes (e.g.
   * `denormalised-aggregate`) accept more than one kind depending on axis
   * values — the dominant kind is listed here and the alternative is recorded
   * in `description`. The recommender's "Shape" block prints whichever value
   * the questionnaire actually implies; this field is used by
   * `dbx://model-archetype/by-collection-kind/{kind}` to filter the catalog.
   */
  readonly collectionKind: FirestoreCollectionKind;
  /**
   * First-paragraph narrative description, also printed by `_lookup`.
   */
  readonly description: string;
  /**
   * One-line guidance for "when to pick this" — appears in the catalog and
   * single-entry views.
   */
  readonly whenToUse: string;
  /**
   * Optional extension-cluster name when this archetype hooks into one of the
   * `_m` model-extension clusters (`storagefile_m`, `notification_m`,
   * `system_m`). Absent for plain archetypes.
   */
  readonly extensionCluster?: 'storagefile_m' | 'notification_m' | 'system_m';
  /**
   * Canonical answer template the scorer compares each questionnaire against.
   */
  readonly expected: ModelArchetypeExpectedAnswers;
  /**
   * Axis name → allowed values. The recommender returns the resolved axis on
   * its output; `_search` accepts an axes filter on these names.
   */
  readonly axes: { readonly [axisName: string]: readonly string[] };
  /**
   * v1/v2 slugs that resolve to this archetype. Surfaced on the lookup tool's
   * deprecation note, accepted as `archetypeHint` overrides and as
   * `_search.archetype` arguments.
   */
  readonly aliases: readonly string[];
  /**
   * Implementation pointers — skill names, sync-flag conventions, peer-search
   * notes. Surfaced verbatim on the recommender's "Implementation pointers"
   * bullet list.
   */
  readonly implementationPointers: readonly string[];
  /**
   * Optional comment shown alongside the slug — used to capture the
   * "is/isn't" disambiguation hints (`external-id-keyed-entity-root` vs.
   * `external-mirror`, `root-singleton-aggregate` vs.
   * `system-state-singleton`, …).
   */
  readonly disambiguation?: string;
}

// MARK: Catalog

/**
 * Full ordered catalog of every archetype. Order follows the planning doc's
 * §2 grouping (standalone-entity → user/external roots → group → aggregate
 * families → mirror/log/registry → framework → add-ons) so the catalog renders
 * predictably.
 */
export const MODEL_ARCHETYPES: readonly ModelArchetypeInfo[] = [
  // === Standalone Entity family ===
  {
    slug: 'root-entity',
    family: 'standalone-entity',
    collectionKind: 'root',
    description: 'Plain root collection — the top-level anchor of a domain.',
    whenToUse: 'Top-level model with no special parent / user / external-id keying.',
    expected: {
      docIdSource: ['auto'],
      parentRelation: ['none'],
      syncMode: ['always-in-sync'],
      isDenormalization: false,
      isExternalMirror: false,
      isEventLog: false
    },
    axes: {},
    aliases: [],
    implementationPointers: ['Read: `dbx__guide__new-model`', 'Use the `root` collection-factory shape (`firestoreContext.firestoreCollection`).']
  },
  {
    slug: 'sub-collection-entity',
    family: 'standalone-entity',
    collectionKind: 'sub-collection',
    description: 'Child of one parent, many-per-parent.',
    whenToUse: 'Entity that always exists under a parent and there are many per parent.',
    expected: {
      docIdSource: ['auto', 'numeric-short-id'],
      parentRelation: ['one-parent'],
      instancesPerParent: ['many'],
      syncMode: ['always-in-sync'],
      isDenormalization: false,
      isExternalMirror: false,
      isEventLog: false
    },
    axes: {},
    aliases: ['subcollection-entity'],
    implementationPointers: ['Use the `sub-collection` collection-factory shape (`firestoreContext.firestoreCollectionWithParent`).', 'Read: `dbx__guide__new-model`']
  },
  {
    slug: 'single-item-sub',
    family: 'standalone-entity',
    collectionKind: 'singleton-sub',
    description: "1:1 with parent; the parent's `side-table.` Sub-purpose is an axis, not a separate archetype.",
    whenToUse: 'Exactly one of these per parent — split because of sensitivity, permission scope, config, state, or aggregated summary.',
    expected: {
      docIdSource: ['parent-id', 'fixed'],
      parentRelation: ['one-parent'],
      instancesPerParent: ['one'],
      isExternalMirror: false,
      isEventLog: false
    },
    axes: {
      subPurpose: ['private', 'permission', 'config', 'state', 'summary', 'member-summary']
    },
    aliases: ['entity-private', 'permission-table', 'group-member-summary'],
    implementationPointers: ['Use the `singleton-sub` collection-factory shape (`firestoreContext.singleItemFirestoreCollection`).', 'Pick `subPurpose` based on what differentiates this side-table from the parent (sensitive fields → private, role-grant map → permission, …).']
  },

  // === User / External-Id Roots family ===
  {
    slug: 'user-keyed-entity-root',
    family: 'user-external-root',
    collectionKind: 'root',
    description: 'Root collection keyed by user uid, holding authoritative user state.',
    whenToUse: 'Per-user document whose Firestore id IS the Firebase Auth uid AND the doc carries authoritative state (not a denormalised slice).',
    expected: {
      docIdSource: ['user-uid'],
      parentRelation: ['user-uid'],
      userRelation: ['uid-is-doc-id'],
      syncMode: ['always-in-sync'],
      isDenormalization: false,
      isExternalMirror: false
    },
    axes: {},
    aliases: [],
    implementationPointers: ['Extend `UserRelatedById` on the interface so the registry auto-tags it.', 'Doc id = the Firebase Auth uid; convention: store `uid` on every related doc that references this user.']
  },
  {
    slug: 'user-keyed-index-root',
    family: 'user-external-root',
    collectionKind: 'root',
    description: 'Root collection keyed by user uid, holding a denormalised slice of related models.',
    whenToUse: 'Per-user rollup or index keyed by uid — eventual consistency, source of truth lives elsewhere.',
    expected: {
      docIdSource: ['user-uid'],
      parentRelation: ['user-uid'],
      userRelation: ['uid-is-doc-id'],
      syncMode: ['flag-eventual', 'trigger-eventual'],
      isDenormalization: true
    },
    axes: {},
    aliases: [],
    implementationPointers: ['Extend `UserRelatedById` on the interface.', 'Document the source models the index denormalises in the interface JSDoc.', 'Pick `syncMode = flag-eventual` if source docs carry a `@dbxModelVariableSyncFlag`; otherwise use `trigger-eventual`.']
  },
  {
    slug: 'external-id-keyed-entity-root',
    family: 'user-external-root',
    collectionKind: 'root',
    description: "Root collection keyed by an external system's id, holding authoritative HelloSubs state about that record.",
    whenToUse: 'Doc id IS the vendor id AND the doc carries authoritative HelloSubs state (not a vendor-shaped cached payload — that is `external-mirror`).',
    disambiguation: 'If this is a mirror of the external record, switch to `external-mirror`.',
    expected: {
      docIdSource: ['external-vendor-id'],
      parentRelation: ['external-vendor-id', 'none'],
      userRelation: ['external-vendor-id-is-doc-id', 'none'],
      syncMode: ['external-bidirectional'],
      isExternalMirror: false
    },
    axes: {},
    aliases: [],
    implementationPointers: ['Doc id = external vendor id (e.g. Zoho candidate id).', 'Webhook patches in; scheduled reconciler patches out.']
  },
  {
    slug: 'geo-key-entity-root',
    family: 'user-external-root',
    collectionKind: 'root',
    description: 'Root collection whose doc id IS a geographic key (region/district/...), holding the per-geo overlay of another model.',
    whenToUse: 'Per-region or per-district overlay keyed directly by the geo key.',
    expected: {
      docIdSource: ['geo-key'],
      parentRelation: ['region-key', 'district-key', 'none'],
      syncMode: ['flag-eventual', 'trigger-eventual']
    },
    axes: {},
    aliases: [],
    implementationPointers: ['Doc id = the geo key (`regionKey`, `districtKey`).', 'Pair with `RegionRelatedById` / `DistrictRelatedById` so the registry auto-tags.']
  },

  // === Group / Membership family ===
  {
    slug: 'group-root',
    family: 'group',
    collectionKind: 'root',
    description: 'Organization / tenant root.',
    whenToUse: 'Top-level tenant boundary that owns many other models as subcollections.',
    expected: {
      docIdSource: ['auto'],
      parentRelation: ['none'],
      syncMode: ['always-in-sync']
    },
    axes: {},
    aliases: [],
    implementationPointers: ['Use the `root` collection-factory shape and tag the interface with `@dbxModelGroup`.']
  },
  {
    slug: 'group-member',
    family: 'group',
    collectionKind: 'sub-collection',
    description: 'One doc per (group, user). Carries per-group role + cached user fields.',
    whenToUse: 'Membership rows under a group root, keyed per-user.',
    expected: {
      parentRelation: ['one-parent'],
      instancesPerParent: ['many'],
      userRelation: ['references-user-key', 'uid-is-doc-id', 'owned-by-uid'],
      syncMode: ['trigger-eventual', 'always-in-sync']
    },
    axes: {},
    aliases: [],
    implementationPointers: ['Cached user fields resync on profile change via a trigger (`trigger-eventual`).']
  },
  {
    slug: 'region-variant-root',
    family: 'group',
    collectionKind: 'root',
    description: 'Per-region overlay of a root group, keyed by `(group, region)` composite. Distinct from `geo-key-entity-root` (single-key) and from a subcollection.',
    whenToUse: 'Per-region overlay where the doc id is `groupKey_regionKey` (composite-flat-key).',
    expected: {
      docIdSource: ['composite-flat-key'],
      parentRelation: ['composite-key', 'none'],
      syncMode: ['always-in-sync']
    },
    axes: {},
    aliases: [],
    implementationPointers: ['Doc id encodes both keys via a composite-flat-key factory.']
  },

  // === Denormalised-Aggregate family ===
  {
    slug: 'denormalised-aggregate',
    family: 'denormalised-aggregate',
    collectionKind: 'sub-collection',
    description: 'Read-optimised denormalised projection over one or more source models. Two axes: `keying` and `syncMode`. May render as a `root` collection when keyed by `composite-flat-key`.',
    whenToUse: 'Periodic / bucketed / parent-keyed projection over source docs that benefits from being read independently.',
    expected: {
      docIdSource: ['parent-id', 'bucket-code', 'composite-flat-key', 'numeric-short-id'],
      isDenormalization: true,
      syncMode: ['trigger-eventual', 'flag-eventual', 'scheduled-rebuild'],
      isExternalMirror: false,
      isEventLog: false
    },
    axes: {
      keying: ['parent-id', 'bucket-code', 'composite-flat-key', 'numeric-short-id'],
      syncMode: ['trigger-eventual', 'flag-eventual', 'scheduled-rebuild']
    },
    aliases: ['digest', 'temporal-summary', 'sync-flagged-composition-index'],
    implementationPointers: ['When `syncMode = flag-eventual`: source carries a `<targetShort>ss` boolean (`SyncedToTargetIfTrue`) annotated with `@dbxModelVariableSyncFlag <description>`.', 'Scheduled reconciler walks flagged docs and patches the target.', 'Read: `dbx__guide__scheduled-function`.']
  },
  {
    slug: 'root-singleton-aggregate',
    family: 'denormalised-aggregate',
    collectionKind: 'root-singleton',
    description: 'Root-level singleton doc aggregating a sibling root collection. Distinct from `single-item-sub:summary` (parented) and from `system-state-singleton` (subsystem state).',
    whenToUse: 'A single root-singleton doc that aggregates a sibling root collection.',
    disambiguation: 'If this is subsystem state with a typed payload, switch to `system-state-singleton`.',
    expected: {
      docIdSource: ['fixed'],
      parentRelation: ['none'],
      isDenormalization: true,
      isSiblingAggregate: true,
      aggregatesFromNonEmpty: true,
      isSubsystemSingleton: false,
      syncMode: ['trigger-eventual']
    },
    axes: {},
    aliases: [],
    implementationPointers: ['Use the `root-singleton` collection-factory shape (`firestoreContext.rootSingleItemFirestoreCollection`).', 'Trigger from the source collection writes patches the singleton.']
  },

  // === Mirror / Integration family ===
  {
    slug: 'external-mirror',
    family: 'mirror-integration',
    collectionKind: 'sub-collection',
    description: 'Holds tokens / state / cached payloads for an external system (Zoho, CheckHQ, VAPI, Typeform).',
    whenToUse: 'Vendor-shaped cached payload (not authoritative HelloSubs state).',
    disambiguation: 'If this carries authoritative HelloSubs state keyed by vendor id, switch to `external-id-keyed-entity-root`.',
    expected: {
      docIdSource: ['parent-id', 'external-vendor-id'],
      isExternalMirror: true,
      syncMode: ['external-bidirectional']
    },
    axes: {},
    aliases: [],
    implementationPointers: ['Webhook patches in; scheduled reconciler patches out.', 'Document the vendor in the interface JSDoc.']
  },

  // === Event / Log family ===
  {
    slug: 'audit-log',
    family: 'event-log',
    collectionKind: 'sub-collection',
    description: 'Append-only sequence of events / instructions with state transitions per entry (`INIT → RUNNING → COMPLETE/FAILED`).',
    whenToUse: 'Per-event row beneath a parent entity that records what happened, with per-row lifecycle states.',
    expected: {
      docIdSource: ['auto', 'numeric-short-id'],
      isEventLog: true,
      mutability: ['immutable'],
      syncMode: ['append-only'],
      isExternalMirror: false
    },
    axes: {},
    aliases: [],
    implementationPointers: ['New rows supersede old; existing rows are not mutated after their terminal state.', 'Read: `hellosubs__ref__job-instructions` for the canonical instruction-runner pattern.']
  },

  // === Registry / Reference family ===
  {
    slug: 'reference-registry',
    family: 'registry-reference',
    collectionKind: 'root',
    description: 'Admin-curated lookup data. Two axes: `hasChildren` (registry has child docs by short numeric id, counter on parent) and `hasInheritance` (overlay graph via `parentIndexes[]`).',
    whenToUse: 'Admin-curated registry of records (with optional inheritance overlay through `parentIndexes[]`).',
    expected: {
      docIdSource: ['auto', 'numeric-short-id'],
      parentRelation: ['none', 'one-parent'],
      hasInheritance: true,
      syncMode: ['append-only', 'always-in-sync']
    },
    axes: {
      hasChildren: ['true', 'false'],
      hasInheritance: ['true', 'false']
    },
    aliases: ['hierarchical-registry'],
    implementationPointers: ['Children use `numeric-short-id`; the parent carries a counter.', 'When `hasInheritance = true`, model the parent overlay graph via `parentIndexes: number[]`.']
  },
  {
    slug: 'geo-hierarchy-root',
    family: 'registry-reference',
    collectionKind: 'root',
    description: 'Chain of root collections (Country → State → Region → District) where each doc ID IS the geographic key.',
    whenToUse: 'Geographic taxonomy with stable admin-curated entries at each level.',
    expected: {
      docIdSource: ['geo-key'],
      parentRelation: ['none', 'region-key', 'district-key'],
      syncMode: ['always-in-sync']
    },
    axes: {},
    aliases: [],
    implementationPointers: ['Each level is a separate root collection keyed directly by its geo key.']
  },
  {
    slug: 'system-state-singleton',
    family: 'registry-reference',
    collectionKind: 'root-singleton',
    description: 'Generic typed container per subsystem (`@dereekb/firebase` `SystemState`).',
    whenToUse: 'Subsystem state singleton with a typed payload — register a converter through the `system_m` cluster.',
    extensionCluster: 'system_m',
    disambiguation: 'If this aggregates a sibling root collection, switch to `root-singleton-aggregate`.',
    expected: {
      docIdSource: ['fixed'],
      parentRelation: ['none'],
      isSubsystemSingleton: true,
      syncMode: ['pull-on-demand']
    },
    axes: {},
    aliases: [],
    implementationPointers: ['Use the `system_m` cluster to register the converter + `*SystemData` interface.', 'Read: `dbx__guide__new-model-checklist`.']
  },
  {
    slug: 'oidc-entry',
    family: 'registry-reference',
    collectionKind: 'root',
    description: 'Per-provider OIDC config (admin-curated).',
    whenToUse: 'OIDC provider record with claim / scope augmentation.',
    expected: {
      docIdSource: ['fixed'],
      parentRelation: ['none'],
      syncMode: ['append-only']
    },
    axes: {},
    aliases: [],
    implementationPointers: ['Read: `dbx__guide__add-oidc`.']
  },

  // === Framework family — dbx-lib reference patterns ===
  {
    slug: 'storagefile-purpose',
    family: 'framework',
    collectionKind: 'root',
    description: 'Adopt `StorageFile` + register a `StorageFilePurpose` for uploads + processing.',
    whenToUse: 'Need a file upload + processing surface — register a purpose through the `storagefile_m` cluster.',
    extensionCluster: 'storagefile_m',
    expected: {
      involvesFileUpload: true,
      syncMode: ['trigger-eventual']
    },
    axes: {},
    aliases: [],
    implementationPointers: ['Read: `dbx__guide__storagefile-purpose`.', 'Wire the purpose through `storagefile_m` cluster validators.']
  },
  {
    slug: 'notification-template',
    family: 'framework',
    collectionKind: 'sub-collection',
    description: 'Register a `NotificationTemplateType` for a new outbound message.',
    whenToUse: 'Need to send a notification to a user — register a template through the `notification_m` cluster.',
    extensionCluster: 'notification_m',
    expected: {
      sendsMessageToUser: true,
      syncMode: ['always-in-sync']
    },
    axes: {},
    aliases: [],
    implementationPointers: ['Read: `dbx__guide__notification-task` for the broader notification pipeline.', 'Wire the template through `notification_m` cluster validators.']
  },
  {
    slug: 'notification-task',
    family: 'framework',
    collectionKind: 'root',
    description: 'Register a `NotificationTaskType` for a multi-checkpoint async workflow.',
    whenToUse: 'Multi-checkpoint async workflow with delay / re-queue semantics.',
    extensionCluster: 'notification_m',
    expected: {
      isMultiCheckpointWorkflow: true
    },
    axes: {},
    aliases: [],
    implementationPointers: ['Read: `dbx__guide__notification-task`.', 'Wire the task through `notification_m` cluster validators.']
  },

  // === Field-level add-ons ===
  {
    slug: 'state-machine-field',
    family: 'addon',
    collectionKind: 'root',
    description: 'Enum field on an existing model.',
    whenToUse: 'Entity has a lifecycle (draft/published/archived, pending/approved/rejected).',
    expected: {
      hasLifecycleStates: true
    },
    axes: {},
    aliases: [],
    implementationPointers: ['Declare the enum in the model source file; reference it from the converter.']
  },
  {
    slug: 'embedded-sub-objects',
    family: 'addon',
    collectionKind: 'root',
    description: '`firestoreObjectArray` / `firestoreSubObject` on an existing model.',
    whenToUse: 'Small (<20–50), always-read-with-parent, no independent queries / access / lifecycle.',
    expected: {},
    axes: {},
    aliases: [],
    implementationPointers: ['Use `@dbxModelSubObject` on the embedded interface.']
  },
  {
    slug: 'active-vs-archive-split',
    family: 'addon',
    collectionKind: 'sub-collection',
    description: 'Two sibling subcollections under the same parent — one `active,` one `archived/finalized` — to keep active queries small while preserving history.',
    whenToUse: 'Model has a clear finalised state; archival improves query cost.',
    expected: {
      hasArchiveCounterpart: true
    },
    axes: {},
    aliases: [],
    implementationPointers: ['Active sub keeps mutable rows; archive sub keeps immutable rows after a clear terminal state.']
  }
];

// MARK: Lookup helpers

const ARCHETYPES_BY_SLUG: ReadonlyMap<ModelArchetypeSlug, ModelArchetypeInfo> = new Map(MODEL_ARCHETYPES.map((a) => [a.slug, a]));
const ARCHETYPES_BY_ALIAS: ReadonlyMap<string, ModelArchetypeInfo> = buildAliasMap();

function buildAliasMap(): ReadonlyMap<string, ModelArchetypeInfo> {
  const map = new Map<string, ModelArchetypeInfo>();
  for (const archetype of MODEL_ARCHETYPES) {
    for (const alias of archetype.aliases) {
      map.set(alias.toLowerCase(), archetype);
    }
  }
  return map;
}

/**
 * Resolves a v3 slug to its archetype entry. Returns `undefined` for unknown
 * slugs — callers should fall back to {@link findModelArchetypeByAlias} or
 * report the slug as not found.
 *
 * @param slug - v3 archetype slug (`'root-entity'`, `'denormalised-aggregate'`, …)
 * @returns the matching catalog entry, or `undefined` when no v3 archetype uses the slug
 */
export function getModelArchetypeBySlug(slug: ModelArchetypeSlug): ModelArchetypeInfo | undefined {
  return ARCHETYPES_BY_SLUG.get(slug);
}

/**
 * Resolves a v1/v2 alias (case-insensitive) to its v3 archetype. Returns
 * `undefined` when neither a v3 slug nor a registered alias matches.
 *
 * @param alias - any case form of a v1/v2 slug (`'entity-private'`, `'digest'`, …)
 * @returns the v3 successor catalog entry, or `undefined`
 */
export function findModelArchetypeByAlias(alias: string): ModelArchetypeInfo | undefined {
  return ARCHETYPES_BY_ALIAS.get(alias.toLowerCase());
}

/**
 * Resolves a slug or alias (case-insensitive) to its archetype entry. The
 * canonical entry point for lookup tools: tries v3 first, then aliases.
 *
 * @param slugOrAlias - any v3 slug or v1/v2 alias
 * @returns the matching catalog entry plus a flag indicating whether the input was a deprecated alias
 */
export function resolveModelArchetype(slugOrAlias: string): { readonly archetype: ModelArchetypeInfo; readonly viaAlias: boolean } | undefined {
  const trimmed = slugOrAlias.trim();
  const lower = trimmed.toLowerCase();
  const v3 = ARCHETYPES_BY_SLUG.get(trimmed as ModelArchetypeSlug) ?? ARCHETYPES_BY_SLUG.get(lower as ModelArchetypeSlug);
  let result: { readonly archetype: ModelArchetypeInfo; readonly viaAlias: boolean } | undefined;
  if (v3) {
    result = { archetype: v3, viaAlias: false };
  } else {
    const alias = ARCHETYPES_BY_ALIAS.get(lower);
    if (alias) {
      result = { archetype: alias, viaAlias: true };
    }
  }
  return result;
}

/**
 * Returns every catalog entry whose `expected.syncMode` includes the given
 * sync mode. Useful for browsing by sync semantics
 * (`dbx://model-archetype/by-sync-mode/{mode}`).
 *
 * @param mode - sync mode to filter by
 * @returns matching archetypes in declaration order
 */
export function getModelArchetypesBySyncMode(mode: ModelArchetypeSyncMode): readonly ModelArchetypeInfo[] {
  return MODEL_ARCHETYPES.filter((a) => a.expected.syncMode?.includes(mode) === true);
}

/**
 * Returns every catalog entry whose implied `collectionKind` matches.
 *
 * @param kind - {@link FirestoreCollectionKind} to filter by
 * @returns matching archetypes in declaration order
 */
export function getModelArchetypesByCollectionKind(kind: FirestoreCollectionKind): readonly ModelArchetypeInfo[] {
  return MODEL_ARCHETYPES.filter((a) => a.collectionKind === kind);
}

/**
 * Returns every catalog entry whose `axes[axisName]` includes the given value.
 *
 * @param axisName - axis to filter on (e.g. `'subPurpose'`, `'keying'`)
 * @param axisValue - the value to filter by
 * @returns matching archetypes in declaration order
 */
export function getModelArchetypesByAxisValue(axisName: string, axisValue: string): readonly ModelArchetypeInfo[] {
  return MODEL_ARCHETYPES.filter((a) => a.axes[axisName]?.includes(axisValue) === true);
}
