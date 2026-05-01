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

import type { ModelValidateCode } from './codes.js';
import type { RemediationHint } from '../rule-catalog/types.js';

/**
 * String-literal union derived from {@link ModelValidateCode}.
 */
export type ViolationCode = `${ModelValidateCode}`;

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
  /**
   * Auto-attached remediation hint pulled from the rule catalog at
   * emission time. `undefined` when no catalog entry exists for the
   * code (the formatter renders no nested block in that case).
   */
  readonly remediation?: RemediationHint;
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
  readonly line: number;
  /**
   * `true` when the interface declaration's JSDoc carries an `@dbxModel`
   * tag. The rich `extract-models` pipeline requires this tag to register
   * the interface as a model variant for downstream traversal/referencing.
   */
  readonly dbxModelTag: boolean;
  readonly fields: readonly ExtractedField[];
}

export interface ExtractedField {
  readonly name: string;
  readonly line: number;
  /**
   * First non-empty description line of the field's JSDoc, or `undefined` if absent.
   */
  readonly jsDocFirstLine: string | undefined;
  /**
   * Long-name argument of the field's `@dbxModelVariable <name>` JSDoc
   * tag, or `undefined` when the tag is absent or empty. Powers the
   * field's catalog long-name and the decoder's display strings. The
   * convention is the field's unabbreviated camelCase variable name
   * (e.g. `uid` → `userUid`, `n` → `name`).
   */
  readonly dbxModelVariableTag: string | undefined;
}

export interface ExtractedGroupInterface {
  readonly name: string;
  readonly exported: boolean;
  readonly properties: readonly { readonly name: string; readonly typeText: string }[];
  readonly line: number;
  /**
   * Value of the group's `@dbxModelGroup [Name]` JSDoc tag. `string` when
   * the tag carries an explicit group name, `true` for a bare
   * `@dbxModelGroup` marker, and `undefined` when the tag is absent.
   * The rich `extract-models` pipeline requires this tag to register the
   * group container.
   */
  readonly dbxModelGroupTag: string | true | undefined;
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
