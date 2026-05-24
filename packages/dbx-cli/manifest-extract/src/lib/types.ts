/**
 * Shared types for the `<model>.api.ts` CRUD walker.
 *
 * A CRUD entry is one callable site in a `<model>.api.ts` file —
 * either a leaf in `<Group>ModelCrudFunctionsConfig` (verb + optional
 * specifier) or a key in `<Group>FunctionTypeMap` (standalone).
 *
 * Consumed both by `dbx-components-mcp`'s `dbx_model_api_*` tools and by the
 * `dbx-cli-firebase-api-manifest` build CLI. Re-exported under
 * `@dereekb/dbx-cli/manifest-extract`.
 */

export type CrudVerb = 'create' | 'read' | 'update' | 'delete' | 'query' | 'invoke' | 'standalone';

export interface CrudEntryDocField {
  readonly name: string;
  readonly typeText: string;
  readonly description?: string;
}

export interface CrudEntry {
  /**
   * Top-level model key from `<Group>ModelCrudFunctionsConfig` (e.g. `profile`,
   * `guestbookEntry`). For standalone entries this is the firebase function
   * key itself.
   */
  readonly model: string;
  readonly verb: CrudVerb;
  /**
   * Specifier sub-key (e.g. `username`, `_`, `subscribeToNotifications`).
   * `undefined` when the verb has no nested specifier object (the value is
   * a bare params reference, e.g. `create: CreateGuestbookParams`), or when
   * the entry is `standalone`.
   */
  readonly specifier: string | undefined;
  /**
   * Bare params type name resolved at the leaf (e.g. `SetProfileUsernameParams`).
   * `undefined` when the leaf could not be resolved to a type reference.
   */
  readonly paramsTypeName: string | undefined;
  /**
   * Result type name when the leaf is a `[Params, Result]` tuple, otherwise
   * `undefined` (implies `void`).
   */
  readonly resultTypeName: string | undefined;
  /**
   * Source line of the leaf property in the type literal.
   */
  readonly line: number;
  /**
   * JSDoc summary on the property signature in `<Group>ModelCrudFunctionsConfig` (or the key
   * in `<Group>FunctionTypeMap`).
   */
  readonly description?: string;
  /**
   * JSDoc summary on the params interface itself (e.g. on `ResetProfilePasswordParams`).
   */
  readonly paramsTypeDescription?: string;
  /**
   * Per-field JSDocs read from the params interface's properties.
   */
  readonly paramsFields?: readonly CrudEntryDocField[];
  /**
   * JSDoc summary on the result interface itself (e.g. on `DownloadProfileArchiveResult`).
   */
  readonly resultTypeDescription?: string;
  /**
   * Per-field JSDocs read from the result interface's properties.
   */
  readonly resultFields?: readonly CrudEntryDocField[];
}

export interface CrudExtraction {
  /**
   * Inferred group pascal name (e.g. `Profile`, `Guestbook`).
   */
  readonly groupName: string | undefined;
  /**
   * Top-level model keys declared in `<Group>ModelCrudFunctionsConfig`,
   * including null-valued entries (e.g. `profilePrivate: null`).
   */
  readonly modelKeys: readonly string[];
  readonly entries: readonly CrudEntry[];
  /**
   * Name of the abstract `*Functions` class declared in the source, when present.
   * Used by the manifest build CLI to bind `<APP>_FIREBASE_FUNCTIONS_CONFIG`
   * class identifiers to source files.
   */
  readonly functionsClassName?: string;
}

/**
 * One `firestoreModelIdentity(...)` declaration found by
 * {@link ../lib/extract-models#extractModelsFromSource}.
 */
export interface ModelExtractionIdentity {
  readonly identityConst: string;
  readonly modelType: string;
  readonly collectionPrefix: string | undefined;
  readonly parentIdentityConst: string | undefined;
}

/**
 * One property on a `@dbxModel`-tagged interface.
 */
export interface ModelExtractionInterfaceProp {
  readonly name: string;
  readonly tsType: string;
  readonly optional: boolean;
  readonly description: string | undefined;
  /**
   * Long form parsed from the property's `@dbxModelVariable <name>` JSDoc tag,
   * when present.
   */
  readonly longName: string | undefined;
  /**
   * Description parsed from the property's `@dbxModelVariableSyncFlag …` JSDoc
   * tag, when present.
   */
  readonly syncFlag: string | undefined;
}

/**
 * One exported `interface` declaration. The walker captures every exported
 * interface so cross-interface lookups (e.g. nested interface refs from a
 * sub-object converter) work; the orchestrator filters by
 * `hasDbxModelTag` to find the canonical model interfaces.
 */
export interface ModelExtractionInterface {
  readonly name: string;
  readonly description: string | undefined;
  readonly hasDbxModelTag: boolean;
  readonly extendsNames: readonly string[];
  readonly props: readonly ModelExtractionInterfaceProp[];
}

/**
 * One field inside a converter's `fields` map.
 */
export interface ModelExtractionConverterField {
  readonly key: string;
  /**
   * Verbatim expression text of the field's value (whitespace collapsed).
   */
  readonly converter: string;
  /**
   * Name of a referenced converter const when the field's expression is
   * `firestoreObjectArray({ objectField: <const> })` or
   * `firestoreSubObject({ objectField: <const> })`. Resolved by the
   * orchestrator against the cross-file converter registry.
   */
  readonly nestedConverterRef?: string;
  /**
   * Inline nested converter when the field's expression is
   * `firestoreObjectArray({ objectField: { fields: { … } } })` or
   * `firestoreSubObject({ objectField: { fields: { … } } })`.
   */
  readonly nestedConverterInline?: ModelExtractionConverter;
  /**
   * `true` when the wrapping factory is `firestoreObjectArray` (array element
   * shape); `false` for `firestoreSubObject`. Only meaningful when one of
   * `nestedConverterRef` or `nestedConverterInline` is set.
   */
  readonly nestedIsArray?: boolean;
}

/**
 * One snapshot-converter call. Captures both top-level
 * `export const <X>Converter = snapshotConverterFunctions<…>(…)` declarations
 * and inline `firestoreSubObject(…)` / `firestoreObjectArray(…)` calls
 * embedded in another converter's field map.
 */
export interface ModelExtractionConverter {
  /**
   * Name of the variable this converter is assigned to. `undefined` when the
   * converter is an inline literal inside another converter's field map.
   */
  readonly converterConst: string | undefined;
  /**
   * Factory function that produced the converter
   * (`snapshotConverterFunctions` / `firestoreSubObject` / `firestoreObjectArray`).
   */
  readonly factory: string;
  /**
   * Generic interface-name argument (e.g. `NotificationBox`), with any nested
   * generic arguments stripped. `undefined` when the call had no type
   * arguments.
   */
  readonly interfaceName: string | undefined;
  /**
   * Source-line number of the converter declaration (1-based) for diagnostics.
   */
  readonly line: number;
  readonly fields: readonly ModelExtractionConverterField[];
}

/**
 * One enum value with its JSDoc paragraph and persisted literal value.
 */
export interface ModelExtractionEnumValue {
  readonly name: string;
  readonly value: number | string;
  readonly description: string | undefined;
}

/**
 * One `export enum` declaration found in the source.
 */
export interface ModelExtractionEnum {
  readonly name: string;
  readonly values: readonly ModelExtractionEnumValue[];
  readonly description: string | undefined;
}

/**
 * One `<X>FirestoreCollections` container tagged with `@dbxModelGroup`.
 */
export interface ModelExtractionGroup {
  /**
   * Group name parsed from the `@dbxModelGroup <name>` JSDoc tag.
   */
  readonly name: string;
  /**
   * Container interface name (e.g. `NotificationFirestoreCollections`).
   */
  readonly containerName: string;
  readonly description: string | undefined;
  /**
   * Model names referenced by the container's `<X>FirestoreCollection` /
   * `<X>FirestoreCollectionFactory` properties, in source order.
   */
  readonly modelNames: readonly string[];
}

/**
 * Per-source-file output of {@link ../lib/extract-models#extractModelsFromSource}.
 *
 * Aggregation across files happens in the firebase-api-manifest orchestrator
 * so cross-file converter consts can be resolved against a global registry.
 */
export interface ModelExtraction {
  readonly identities: readonly ModelExtractionIdentity[];
  readonly interfaces: readonly ModelExtractionInterface[];
  readonly converters: readonly ModelExtractionConverter[];
  readonly enums: readonly ModelExtractionEnum[];
  readonly modelGroups: readonly ModelExtractionGroup[];
}
