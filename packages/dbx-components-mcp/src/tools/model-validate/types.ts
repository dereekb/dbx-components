/**
 * Shared types for the `dbx_validate_firebase_model` validator.
 *
 * The validator runs on one or more TypeScript source files that define
 * @dereekb/firebase model groups. A single file normally declares a
 * `<Group>FirestoreCollections` interface, a `<Group>Types` union, and one
 * or more model blocks (each anchored on a `firestoreModelIdentity(...)`
 * call). Rules are expressed as hard errors only — convention adherence is
 * expected to be correctable by the caller.
 */

/**
 * Stable error codes so consumers can suppress or interpret individual
 * violations without string-matching the message text.
 */
export type ViolationCode =
  // File-level
  | 'FILE_MISSING_GROUP_INTERFACE'
  | 'FILE_GROUP_INTERFACE_NOT_EXPORTED'
  | 'FILE_GROUP_INTERFACE_AFTER_MODEL'
  | 'FILE_MISSING_GROUP_TYPES'
  | 'FILE_GROUP_TYPES_NOT_EXPORTED'
  | 'FILE_GROUP_TYPES_AFTER_MODEL'
  | 'FILE_GROUP_TYPES_MISSING_IDENTITY'
  | 'FILE_GROUP_TYPES_UNKNOWN_IDENTITY'
  | 'FILE_GROUP_INTERFACE_MISSING_COLLECTION'
  // Per-model identity
  | 'MODEL_IDENTITY_NOT_EXPORTED'
  | 'MODEL_IDENTITY_BAD_ARGS'
  // Per-model declarations
  | 'MODEL_MISSING_INTERFACE'
  | 'MODEL_INTERFACE_NOT_EXPORTED'
  | 'MODEL_MISSING_ROLES'
  | 'MODEL_ROLES_NOT_EXPORTED'
  | 'MODEL_MISSING_DOCUMENT_CLASS'
  | 'MODEL_DOCUMENT_CLASS_NOT_EXPORTED'
  | 'MODEL_DOCUMENT_WRONG_BASE_CLASS'
  | 'MODEL_DOCUMENT_BAD_TYPE_ARGS'
  | 'MODEL_DOCUMENT_MISSING_IDENTITY_GETTER'
  | 'MODEL_DOCUMENT_WRONG_IDENTITY_GETTER'
  | 'MODEL_MISSING_CONVERTER'
  | 'MODEL_CONVERTER_NOT_EXPORTED'
  | 'MODEL_MISSING_COLLECTION_REFERENCE'
  | 'MODEL_MISSING_COLLECTION_TYPE'
  | 'MODEL_COLLECTION_TYPE_WRONG_GENERIC'
  | 'MODEL_COLLECTION_FACTORY_TYPE_MISMATCH'
  | 'MODEL_MISSING_COLLECTION_FN'
  | 'MODEL_OUT_OF_ORDER'
  // Subcollection extras
  | 'SUB_MISSING_COLLECTION_REFERENCE_FACTORY'
  | 'SUB_MISSING_COLLECTION_FACTORY_TYPE'
  | 'SUB_MISSING_COLLECTION_FACTORY_FN'
  | 'SUB_MISSING_COLLECTION_GROUP_REFERENCE'
  | 'SUB_MISSING_COLLECTION_GROUP_TYPE'
  | 'SUB_MISSING_COLLECTION_GROUP_FN'
  // Warnings (style / convention)
  | 'MODEL_FIELD_NAME_TOO_LONG'
  | 'MODEL_FIELD_MISSING_JSDOC'
  | 'MODEL_FIELD_JSDOC_NO_FULL_NAME';

/**
 * Error codes are hard failures the caller is expected to fix. Warning codes
 * flag convention deviations — validation is still considered a pass.
 */
import type { ViolationSeverity } from '../validate-format.js';
export type { ViolationSeverity };

export interface Violation {
  readonly code: ViolationCode;
  readonly severity: ViolationSeverity;
  readonly message: string;
  readonly file: string;
  readonly line: number | undefined;
  readonly model: string | undefined;
}

export interface ValidationResult {
  readonly violations: readonly Violation[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly filesChecked: number;
  readonly modelsChecked: number;
}

/**
 * Max length (inclusive) allowed for a Firestore data-interface field name
 * before {@link MODEL_FIELD_NAME_TOO_LONG} warns. Matches the workspace
 * convention of 1–4 character abbreviations (`uid`, `n`, `cat`, `uat`).
 */
export const MAX_FIELD_NAME_LENGTH = 4;

/**
 * One file's raw contents passed into the validator. Callers reading paths or
 * globs off disk resolve them to this shape before calling into the core.
 */
export interface ValidatorSource {
  readonly name: string;
  readonly text: string;
}

export type ModelVariant = 'root' | 'subcollection';

/**
 * Canonical taxonomy of Firestore-collection shapes a model can declare.
 * Mirrors the consumer-side store-shape labels used in
 * `firebase-lookup.formatter.ts` so the verbiage is identical end-to-end
 * (registry → validator → MCP responses).
 *
 * - `'root'`: standard root collection. Type alias `FirestoreCollection<T, D>`,
 *   factory body calls `firestoreContext.firestoreCollection({...})`.
 * - `'root-singleton'`: single-document root collection (e.g. an app-config
 *   doc). Type alias `RootSingleItemFirestoreCollection<T, D>`, factory body
 *   calls `firestoreContext.rootSingleItemFirestoreCollection({...})`.
 * - `'sub-collection'`: multi-item subcollection under a parent. Type alias
 *   `FirestoreCollectionWithParent<T, PT, D, PD>`, factory body calls
 *   `firestoreContext.firestoreCollectionWithParent({...})`.
 * - `'singleton-sub'`: one-document-per-parent subcollection (e.g.
 *   `<parent>/private/private`). Type alias
 *   `SingleItemFirestoreCollection<T, PT, D, PD>`, factory body calls
 *   `firestoreContext.singleItemFirestoreCollection({...})`.
 */
export type FirestoreCollectionKind = 'root' | 'root-singleton' | 'sub-collection' | 'singleton-sub';

/**
 * Canonical order of required declarations for a root-collection model.
 * Consulted by the order-check rule.
 */
export const ROOT_MODEL_ORDER = ['identity', 'interface', 'rolesType', 'documentClass', 'converter', 'referenceFn', 'collectionType', 'collectionFn'] as const;

/**
 * Canonical order for a subcollection model. `referenceFn` slot holds the
 * `*CollectionReferenceFactory` for a subcollection. The collection-group
 * trio (`referenceGroupFn`, `collectionGroupType`, `collectionGroupFn`)
 * comes after the single-item factory trio.
 */
export const SUBCOLLECTION_MODEL_ORDER = ['identity', 'interface', 'rolesType', 'documentClass', 'converter', 'referenceFn', 'collectionType', 'collectionFactoryType', 'collectionFn', 'referenceGroupFn', 'collectionGroupType', 'collectionGroupFn'] as const;

export type DeclarationKind = (typeof ROOT_MODEL_ORDER)[number] | (typeof SUBCOLLECTION_MODEL_ORDER)[number];

export interface ExtractedFile {
  readonly name: string;
  readonly groupInterface: ExtractedGroupInterface | undefined;
  readonly groupTypes: ExtractedGroupTypes | undefined;
  readonly firstModelLine: number | undefined;
  readonly models: readonly ExtractedModel[];
  readonly dataInterfaces: readonly ExtractedDataInterface[];
}

/**
 * A non-group interface declared in the file — either a model data
 * interface (`Profile`, `ProfilePrivate`) or an embedded sub-object type
 * (`UserInviteEmbeddedInvite`). Both are serialized to Firestore and thus
 * subject to the short-field-name convention.
 */
export interface ExtractedDataInterface {
  readonly name: string;
  readonly fields: readonly ExtractedField[];
}

export interface ExtractedField {
  readonly name: string;
  readonly line: number;
  /**
   * First non-empty description line of the field's JSDoc, or `undefined` if absent.
   */
  readonly jsDocFirstLine: string | undefined;
}

export interface ExtractedGroupInterface {
  readonly name: string;
  readonly exported: boolean;
  readonly properties: readonly { readonly name: string; readonly typeText: string }[];
  readonly line: number;
}

export interface ExtractedGroupTypes {
  readonly name: string;
  readonly exported: boolean;
  readonly identityRefs: readonly string[];
  readonly line: number;
}

export interface ExtractedModel {
  readonly name: string;
  readonly camelName: string;
  readonly variant: ModelVariant;
  readonly identity: ExtractedIdentity;
  readonly iface: ExtractedDecl | undefined;
  readonly rolesType: ExtractedDecl | undefined;
  readonly documentClass: ExtractedDocumentClass | undefined;
  readonly converter: ExtractedDecl | undefined;
  readonly accessorFactory: ExtractedDecl | undefined;
  readonly referenceFn: ExtractedDecl | undefined;
  readonly referenceGroupFn: ExtractedDecl | undefined;
  readonly collectionType: ExtractedDecl | undefined;
  readonly collectionFactoryType: ExtractedDecl | undefined;
  readonly collectionGroupType: ExtractedDecl | undefined;
  readonly collectionFn: ExtractedDecl | undefined;
  readonly collectionGroupFn: ExtractedDecl | undefined;
  /**
   * Collection kind discriminator derived from the factory body's
   * `firestoreContext.*` call. `undefined` when the factory is missing or
   * the call site cannot be located.
   */
  readonly factoryCallKind: FirestoreCollectionKind | undefined;
}

export interface ExtractedIdentity {
  readonly constName: string;
  readonly exported: boolean;
  readonly parentIdentityRef: string | undefined;
  readonly collectionName: string;
  readonly prefix: string;
  readonly line: number;
}

export interface ExtractedDecl {
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
  readonly typeText?: string;
}

export interface ExtractedDocumentClass {
  readonly name: string;
  readonly exported: boolean;
  readonly line: number;
  readonly baseClass: string;
  readonly typeArgs: readonly string[];
  readonly hasModelIdentityGetter: boolean;
  readonly modelIdentityReturn: string | undefined;
}
