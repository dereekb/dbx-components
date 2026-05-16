/**
 * Firebase Models Registry.
 *
 * Canonical metadata for @dereekb/firebase Firestore models — their identity
 * (`firestoreModelIdentity(...)`), persisted fields (derived from
 * `snapshotConverterFunctions({ fields: ... })`), and declared enums.
 *
 * The PRIMARY search index is `collectionPrefix` — the short code that appears
 * in Firestore document keys (`sf/abc123` → StorageFile). That's the fastest
 * way to identify a raw document. Secondary indexes: model `name`
 * (`StorageFile`, `NotificationBox`) and parent identity for subcollections.
 *
 * Data lives in the generated module imported below and is emitted by the
 * `generate-firebase-models` nx target (`scripts/extract-firebase-models.mjs`).
 * Edit the script — never the generated file by hand.
 */

/**
 * One TypeScript enum value declared alongside a model. The `value` is the
 * raw persisted integer/string; `description` is the leading JSDoc line.
 */
export interface FirebaseEnumValue {
  readonly name: string;
  readonly value: number | string;
  readonly description?: string;
}

/**
 * A TypeScript enum declared in the same source file as a model. Collected so
 * the decode tool can translate raw integer values (`fs: 2`) back to
 * human-readable names (`StorageFileState.OK`).
 */
export interface FirebaseEnum {
  readonly name: string;
  readonly values: readonly FirebaseEnumValue[];
  readonly description?: string;
}

/**
 * A persisted field on a Firestore document.
 *
 * The canonical field list comes from `snapshotConverterFunctions({ fields })`
 * — the converter is the source of truth for what Firestore stores. TypeScript
 * type and JSDoc description are joined in from the corresponding `interface`
 * property when one exists (may be absent for fields inherited from `extends`
 * clauses).
 */
export interface FirebaseField {
  /**
   * Field name as it appears in Firestore and on the TS interface.
   */
  readonly name: string;
  /**
   * Long-form camelCase identifier for the field, sourced from the `@dbxModelVariable` JSDoc tag.
   *
   * The convention is the field's unabbreviated camelCase variable name (e.g. `uid` → `userUid`,
   * `n` → `name`, `crAt` → `createdAt`), providing a human-readable expansion of the (often
   * 1-4 character) persisted name for use by MCP tooling and downstream documentation. Defaults
   * to `name` when no tag is present (and the scanner emits a warning).
   */
  readonly longName: string;
  /**
   * Raw converter expression, e.g. `'firestoreDate()'`, `'optionalFirestoreString()'`.
   */
  readonly converter: string;
  /**
   * TS type string from the interface when available (e.g. `'StorageFileState'`, `'Maybe<Date>'`).
   */
  readonly tsType?: string;
  /**
   * `true` when the interface property is optional (`?:` or `Maybe<T>`).
   */
  readonly optional: boolean;
  /**
   * First JSDoc paragraph stripped of tags.
   */
  readonly description?: string;
  /**
   * Name of an enum declared in this file referenced by `tsType` / converter.
   */
  readonly enumRef?: string;
  /**
   * Sync-flag annotation sourced from the `@dbxModelVariableSyncFlag` JSDoc tag on the field.
   *
   * The tag's text describes what the flag synchronizes when the field is set
   * (e.g. `'Sync the Worker record to its Zoho Recruit candidate.'`). Used to
   * generate the cross-model "Sync flags" section in `dbx_model_lookup` output
   * for fields like `zs`, `rs`, `*ss`, etc. — denormalization triggers that
   * `tsType` alone can't reveal. Absent when the field has no
   * `@dbxModelVariableSyncFlag` tag.
   */
  readonly syncFlag?: string;
  /**
   * Embedded sub-object structure when the field's converter resolves
   * through a `firestoreSubObject<T>` / `firestoreObjectArray<T>` /
   * `firestoreMap<T>` factory whose `T` carries the `@dbxModelSubObject`
   * JSDoc tag. Populated by the rich extractor's cross-file walk so the
   * catalog can render the nested field table and accept the sub-object's
   * long names in `fields:[...]` filters. Absent when the field is a
   * plain primitive or when the sub-object interface cannot be resolved
   * from the validated model root (e.g. external-package shapes).
   */
  readonly subObject?: FirebaseSubObject;
}

/**
 * Catalog metadata for an embedded sub-object interface persisted as
 * part of a parent model's converter (`firestoreSubObject<T>`,
 * `firestoreObjectArray<T>`, `firestoreMap<T>`). Attached to the parent
 * field as {@link FirebaseField.subObject} when both the converter
 * const and the underlying interface (tagged `@dbxModelSubObject`) are
 * visible to the extractor.
 */
export interface FirebaseSubObject {
  /**
   * Interface name (the type-argument of the sub-object factory call —
   * e.g. `WorkerPayStubItem`, `BillingGroupRegionEmbeddedBillingGroup`).
   */
  readonly interfaceName: string;
  /**
   * Factory shape: `'object'` for a single embedded record
   * (`firestoreSubObject`), `'array'` for a list
   * (`firestoreObjectArray`), `'map'` for a keyed map (`firestoreMap`).
   * Drives the formatter's section label.
   */
  readonly factoryKind: 'object' | 'array' | 'map';
  /**
   * Sub-object's own persisted fields, in declaration order. Each field
   * carries its `@dbxModelVariable` long-name and any nested
   * `@dbxModelSubObject` chain so the catalog can render arbitrarily
   * deep embedded structures.
   */
  readonly fields: readonly FirebaseField[];
}

/**
 * Re-export of the canonical {@link FirestoreCollectionKind} taxonomy used
 * across the validator and registry so consumers see one consistent label
 * set for every Firestore-collection shape.
 */
export type { FirestoreCollectionKind } from '../tools/model-validate/types.js';

import type { FirestoreCollectionKind } from '../tools/model-validate/types.js';

/**
 * A Firestore model entry.
 */
export interface FirebaseModel {
  /**
   * Interface / class name (e.g. `'StorageFile'`, `'NotificationBox'`).
   */
  readonly name: string;
  /**
   * First JSDoc paragraph from the model's `@dbxModel` interface declaration. Captures the
   * business-purpose narrative ("A Worker represents a substitute teacher…") so consumers
   * don't have to open the source file. Absent when the interface has no leading JSDoc.
   */
  readonly description?: string;
  /**
   * Identity constant name (e.g. `'storageFileIdentity'`).
   */
  readonly identityConst: string;
  /**
   * Model type string passed to `firestoreModelIdentity` (e.g. `'storageFile'`).
   */
  readonly modelType: string;
  /**
   * PRIMARY INDEX — collection prefix as it appears in Firestore keys (`'sf'`, `'nb'`, `'sys'`).
   */
  readonly collectionPrefix: string;
  /**
   * Identity const of the parent model for subcollections. Absent for root collections.
   */
  readonly parentIdentityConst?: string;
  /**
   * Package the model lives in (`'@dereekb/firebase'` for upstream, downstream
   * package name like `'demo-firebase'` for component packages discovered at
   * runtime).
   */
  readonly sourcePackage: string;
  /**
   * Source file path relative to the workspace root.
   */
  readonly sourceFile: string;
  /**
   * Persisted fields, canonical list from the converter.
   */
  readonly fields: readonly FirebaseField[];
  /**
   * Enums declared in the same file (may be referenced by field types).
   */
  readonly enums: readonly FirebaseEnum[];
  /**
   * Unique-ish field names used to auto-detect the model from raw JSON when no hint is supplied.
   */
  readonly detectionHints: readonly string[];
  /**
   * Group name from the `@dbxModelGroup` tag on the model's `<X>FirestoreCollections` container
   * (e.g. `'Notification'`). Defaults to the container name with the `FirestoreCollections`
   * suffix stripped when the tag has no explicit argument.
   *
   * Absent when the file declares no model-group container.
   */
  readonly modelGroup?: string;
  /**
   * Firestore-collection shape, derived by inspecting the model's
   * `<modelType>FirestoreCollection` / `<modelType>FirestoreCollectionFactory`
   * function body for the `firestoreContext.*` call it makes. Mirrors the
   * consumer-side store-shape labels: `'root'`, `'root-singleton'`,
   * `'sub-collection'`, `'singleton-sub'`. Absent when the scanner cannot
   * locate a recognised call (e.g. exotic factory shapes).
   */
  readonly collectionKind?: FirestoreCollectionKind;
  /**
   * `true` when the model's interface (or one of its same-file ancestors)
   * extends `UserRelatedById` from `@dereekb/firebase` — meaning the
   * Firestore document's id IS a Firebase Auth user uid, so the doc is 1:1
   * with a user. Surfaced through `dbx_model_lookup`, `dbx_model_search`,
   * and the `dbx://model/firebase/user-keyed-by-id` resource so consumers
   * can quickly enumerate the per-user document set.
   */
  readonly userKeyedById?: boolean;
  /**
   * `true` when the model's interface (or one of its same-file ancestors)
   * extends `UserRelated` (alias of `FirebaseAuthUserIdRef`) from
   * `@dereekb/firebase` — meaning the document carries an explicit `uid`
   * field referencing the Firebase Auth user. Independent of
   * {@link userKeyedById}: a model can have either, both, or neither.
   */
  readonly hasUserUidField?: boolean;
  /**
   * `true` when the model's interface (or one of its same-file ancestors)
   * extends `RegionRelatedById` — i.e. the Firestore document id IS the
   * region key. Parallel signal to {@link userKeyedById} used by the model
   * archetype recommender and by the `dbx://model/firebase/region-keyed-by-id`
   * resource.
   */
  readonly regionKeyedById?: boolean;
  /**
   * `true` when the model's interface extends `DistrictRelatedById` — doc id
   * IS the district key. Parallel signal to {@link regionKeyedById}.
   */
  readonly districtKeyedById?: boolean;
  /**
   * `true` when the model's interface (or one of its same-file ancestors)
   * extends one of the `*ExternalIdRelatedById` marker interfaces — meaning
   * the Firestore document id IS an external vendor id (Zoho candidate id,
   * etc.). Used by the model archetype recommender to disambiguate
   * `external-id-keyed-entity-root` from `external-mirror`.
   */
  readonly externalIdKeyedById?: boolean;
  /**
   * `true` when the model's interface (or one of its same-file ancestors)
   * extends a `*BucketKeyRelatedById` / `*YearWeekRelatedById` marker — i.e.
   * the Firestore document id IS a temporal bucket code (year-week, year-month,
   * …). Drives the `denormalised-aggregate.keying = bucket-code` axis on the
   * archetype recommender.
   */
  readonly bucketKeyedById?: boolean;
  /**
   * Primary archetype slug for this model when known. Populated by the
   * `extract-firebase-models` heuristic (or pinned by an explicit
   * `@dbxModelArchetype <slug>` JSDoc tag on the model interface). Absent
   * when the heuristic cannot tag the model with high enough confidence.
   *
   * The slug values are the v3 catalog keys from
   * `src/registry/archetypes.ts:MODEL_ARCHETYPES`. Surfaced through
   * `dbx_model_lookup` and consumed by `dbx_model_archetype_search` peer
   * search.
   */
  readonly archetype?: string;
  /**
   * Optional axis refinements for {@link archetype} (e.g. `{ subPurpose: 'private' }`
   * for `single-item-sub` or `{ keying: 'bucket-code', syncMode: 'flag-eventual' }`
   * for `denormalised-aggregate`). Populated from the same JSDoc override or
   * heuristic that fills {@link archetype}.
   */
  readonly archetypeAxes?: { readonly [axisName: string]: string };
}

/**
 * A `<Name>FirestoreCollections` container class tagged with `@dbxModelGroup`.
 *
 * Captures which models are aggregated together for dependency injection and documentation purposes.
 */
export interface FirebaseModelGroup {
  /**
   * Group name from `@dbxModelGroup <name>` (e.g. `'Notification'`).
   *
   * Defaults to the container name with the `FirestoreCollections` suffix stripped when the
   * tag is bare (`@dbxModelGroup` with no argument). The scanner emits a warning in that case.
   */
  readonly name: string;
  /**
   * Name of the abstract class / interface tagged with `@dbxModelGroup`
   * (e.g. `'NotificationFirestoreCollections'`).
   */
  readonly containerName: string;
  /**
   * Package the group lives in (`'@dereekb/firebase'` for upstream, downstream
   * package name like `'demo-firebase'` for component packages discovered at
   * runtime).
   */
  readonly sourcePackage: string;
  /**
   * Source file path relative to the workspace root.
   */
  readonly sourceFile: string;
  /**
   * First JSDoc paragraph from the class declaration.
   */
  readonly description?: string;
  /**
   * Names of the models referenced by this group's collection accessors (e.g. `['NotificationUser', 'NotificationBox']`).
   *
   * Derived from the `<Model>FirestoreCollection` / `<Model>FirestoreCollectionFactory` / `<Model>FirestoreCollectionGroup`
   * type names found on the group's declared properties.
   */
  readonly modelNames: readonly string[];
}

export { FIREBASE_MODELS, FIREBASE_MODEL_GROUPS } from '../../generated/firebase-models.generated.js';
