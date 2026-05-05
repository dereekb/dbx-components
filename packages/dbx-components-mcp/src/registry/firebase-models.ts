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
