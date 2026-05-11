/**
 * Internal helper types for the rich Firebase-model ts-morph extractor.
 *
 * These types describe the per-file extraction outputs that
 * {@link ../../scan/extract-models/index.ts} stitches together into
 * {@link FirebaseModel} / {@link FirebaseModelGroup} entries.
 */

import type { FirestoreCollectionKind } from '../../tools/model-validate/types.js';

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
 * One `export interface` declaration. The `tags` flags drive model
 * detection (`@dbxModel`) and embedded-sub-object detection
 * (`@dbxModelSubObject` — interfaces persisted as part of a parent
 * model's converter via `firestoreSubObject<T>`, lacking their own
 * `firestoreModelIdentity`).
 */
export interface ExtractedInterface {
  readonly name: string;
  readonly description: string | undefined;
  readonly tags: { readonly dbxModel: boolean; readonly dbxModelSubObject: boolean };
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
