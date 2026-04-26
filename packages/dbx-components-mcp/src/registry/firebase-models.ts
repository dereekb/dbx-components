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
}

/**
 * A Firestore model entry.
 */
export interface FirebaseModel {
  /**
   * Interface / class name (e.g. `'StorageFile'`, `'NotificationBox'`).
   */
  readonly name: string;
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
}

export { FIREBASE_MODELS } from './firebase-models.generated.js';
