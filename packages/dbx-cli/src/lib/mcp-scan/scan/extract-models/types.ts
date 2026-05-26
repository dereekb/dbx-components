/**
 * Internal helper types for the rich Firebase-model ts-morph extractor.
 *
 * These types describe the per-file extraction outputs that
 * {@link ../../scan/extract-models/index.ts} stitches together into
 * {@link FirebaseModel} / {@link FirebaseModelGroup} entries.
 */

import type { FirestoreCollectionKind } from '../../registry/firebase-models.js';

/**
 * One `firestoreModelIdentity(...)` declaration.
 */
export interface ExtractedIdentity {
  readonly identityConst: string;
  readonly modelType: string;
  readonly collectionPrefix: string | undefined;
  readonly parentIdentityConst: string | undefined;
}

/**
 * One field declared on an interface body. Captures the JSDoc
 * description plus the explicit `@dbxModelVariable` long-name tag and
 * the optional `@dbxModelVariableSyncFlag` sync-description tag.
 */
export interface ExtractedInterfaceProp {
  readonly name: string;
  readonly tsType: string;
  readonly optional: boolean;
  readonly description: string | undefined;
  readonly longName: string | undefined;
  readonly syncFlag: string | undefined;
}

/**
 * Parsed `@dbxModelArchetype <slug>[ axisKey=val,...]` JSDoc override.
 * Mirrors the `.mjs` extractor's `parseArchetypeTagValue` output.
 */
export interface ExtractedArchetypeTag {
  readonly slug: string;
  readonly axes: { readonly [key: string]: string };
}

/**
 * Parsed `@dbxModelCompositeKey from=<ModelA>,<ModelB> encoding=<two-way|one-way>`
 * JSDoc tag, applied to interfaces whose Firestore doc id is a composite-flat-key
 * encoding of one or more source model keys. `from=*` is the wildcard form used
 * by framework models that accept any source identity (e.g. `NotificationBox`).
 */
export interface ExtractedCompositeKeyTag {
  /**
   * `'*'` for the wildcard form, or an ordered list of source-model names
   * (interface name, identity const name, or modelType — same resolution as
   * `getFirebaseModel`). Empty array when the tag is malformed (missing `from=`).
   */
  readonly from: readonly string[] | '*';
  /**
   * `'two-way'` for `twoWayFlatFirestoreModelKey` encoding, `'one-way'` for
   * `flatFirestoreModelKey`. `undefined` when the tag is malformed.
   */
  readonly encoding: 'two-way' | 'one-way' | undefined;
}

/**
 * Allowed `@dbxModelRead` levels. Three statically-inferable cases plus the `permissions`
 * escape hatch for any non-trivial computed read grant. Mirrors the ESLint rule's
 * `READ_LEVEL_VALUES` (see `require-dbx-model-companion-tags.rule.ts`).
 */
export type DbxModelReadLevel = 'system' | 'owner' | 'admin-only' | 'permissions';

/**
 * JSDoc-derived tag bag attached to one `export interface` declaration.
 * `dbxModelArchetypes` is repeatable — every `@dbxModelArchetype` occurrence
 * appends to the array. `dbxModelAggregatesFrom` is also repeatable.
 * `dbxModelOrganizationalGroupRoot` is a boolean presence flag.
 * `dbxModelCompositeKey` is at most one per interface — if multiple are
 * declared, only the first is captured and the rest produce validation
 * findings. `dbxModelRead` is at most one per interface; invalid values are
 * dropped silently (the ESLint rule is the user-facing gate).
 */
export interface ExtractedInterfaceTags {
  readonly dbxModel: boolean;
  readonly dbxModelSubObject: boolean;
  readonly dbxModelArchetypes: readonly ExtractedArchetypeTag[];
  readonly dbxModelAggregatesFrom: readonly string[];
  readonly dbxModelOrganizationalGroupRoot: boolean;
  readonly dbxModelCompositeKey?: ExtractedCompositeKeyTag;
  readonly dbxModelRead?: DbxModelReadLevel;
}

/**
 * One `export interface` declaration. The `tags` flags drive model
 * detection (`@dbxModel`) and embedded-sub-object detection
 * (`@dbxModelSubObject` — interfaces persisted as part of a parent
 * model's converter via `firestoreSubObject<T>`, lacking their own
 * `firestoreModelIdentity`). `dbxModelArchetypes` carries any explicit
 * archetype-slug overrides; the heuristic only runs when the array is empty.
 */
export interface ExtractedInterface {
  readonly name: string;
  readonly description: string | undefined;
  readonly tags: ExtractedInterfaceTags;
  readonly extendsNames: readonly string[];
  readonly props: readonly ExtractedInterfaceProp[];
}

/**
 * One `<x>Converter = snapshotConverterFunctions<<X>>({ fields: { ... } })`
 * declaration. The `fields` array preserves the canonical persisted name.
 */
export interface ExtractedConverter {
  readonly converterConst: string;
  readonly interfaceName: string;
  readonly fields: readonly { readonly key: string; readonly converter: string }[];
}

/**
 * One enum value with its persisted integer/string and JSDoc paragraph.
 */
export interface ExtractedEnumValue {
  readonly name: string;
  readonly value: number | string;
  readonly description: string | undefined;
}

/**
 * One `export enum` declaration.
 */
export interface ExtractedEnum {
  readonly name: string;
  readonly values: readonly ExtractedEnumValue[];
  readonly description: string | undefined;
}

/**
 * One `<X>FirestoreCollections` container tagged with `@dbxModelGroup`.
 */
export interface ExtractedModelGroup {
  readonly name: string;
  readonly containerName: string;
  readonly description: string | undefined;
  readonly modelNames: readonly string[];
}

/**
 * Map of `<modelType>FirestoreCollection(Factory)?` factory function names to
 * the {@link FirestoreCollectionKind} their body declares.
 */
export type ExtractedFactoryKindMap = ReadonlyMap<string, FirestoreCollectionKind>;

/**
 * One `export const <name> = firestoreSubObject<T>(...)` /
 * `firestoreObjectArray<T>(...)` / `firestoreMap<T>(...)` declaration. The
 * registered `interfaceName` is the bare type-argument (`T`); the
 * `factoryName` discriminates the call shape so the catalog can surface
 * an `array` or `map` annotation when rendering the embedded sub-object.
 */
export interface ExtractedSubObjectConst {
  readonly constName: string;
  readonly interfaceName: string;
  readonly factoryName: 'firestoreSubObject' | 'firestoreObjectArray' | 'firestoreMap';
}

/**
 * One `@dbxModelServiceFactory <modelType>`-tagged variable export. The model extractor
 * joins these onto matching {@link ExtractedInterface}s by `modelType` so each
 * {@link FirebaseModel} entry surfaces the factory that implements it.
 */
export interface ExtractedServiceFactory {
  /**
   * The `FirestoreModelIdentity.modelType` string declared by the tag (e.g. `guestbook`,
   * `guestbookEntry`). Only camelCase identifiers are emitted — invalid values are dropped
   * silently at scan time.
   */
  readonly modelType: string;
  /**
   * Name of the exported binding the factory call was assigned to
   * (e.g. `guestbookFirebaseModelServiceFactory`).
   */
  readonly exportName: string;
}
