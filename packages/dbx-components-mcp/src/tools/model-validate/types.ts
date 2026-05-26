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
export type { ViolationSeverity } from '../validate-format.js';

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
 * Default max length (inclusive) allowed for a Firestore data-interface field
 * name before `MODEL_FIELD_NAME_TOO_LONG` warns. Matches the workspace
 * convention of 1–5 character abbreviations (`uid`, `n`, `cat`, `uat`,
 * `cuid`). Used as the fallback when no `dbx-mcp.config.json`
 * `modelValidate.maxFieldNameLength` override is supplied via {@link RuleOptions}.
 */
export const MAX_FIELD_NAME_LENGTH = 5;

/**
 * Optional per-call overrides for the firebase-model rule pipeline. The MCP
 * server resolves these from `dbx-mcp.config.json` at bootstrap and threads
 * them through {@link runRules}. Direct callers of `validateFirebaseModelSources`
 * (tests, folder validator) may pass them inline.
 */
export interface RuleOptions {
  /**
   * Override for {@link MAX_FIELD_NAME_LENGTH}. Field names with `length`
   * exceeding this value trigger `MODEL_FIELD_NAME_TOO_LONG`.
   */
  readonly maxFieldNameLength?: number;
  /**
   * Field names that should never trigger field-level convention warnings —
   * currently `MODEL_FIELD_NAME_TOO_LONG` (regardless of the configured
   * limit) and `MODEL_FIELD_LONG_NAME_EQUALS_NAME` (when the short name is
   * already the unabbreviated form). Globally scoped — matched by exact
   * name, no regex, no per-interface qualification.
   */
  readonly ignoredFieldNames?: ReadonlySet<string>;
  /**
   * Parent-interface names whose `MODEL_SUBOBJECT_PARENT_NOT_TAGGED`
   * warning the validator should suppress when the parent is classified
   * "external" (not declared in the validated source set). Useful for
   * framework shapes like `IndexRef`, `DateCellRange`, `DateRange` whose
   * fields are well-known plumbing and don't need surface long-names in
   * the catalog. Match is exact, case-sensitive, on the parent interface
   * name as written in the `extends` clause.
   */
  readonly ignoredExternalParents?: ReadonlySet<string>;
}

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
 * Canonical definition lives in `@dereekb/dbx-cli` (mcp-scan registry) so
 * the scanners and validator share one source of truth.
 */
export type { FirestoreCollectionKind } from '@dereekb/dbx-cli';

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
  /**
   * `firestoreSubObject<T>(...)` / `firestoreObjectArray<T>(...)` /
   * `firestoreMap<T>(...)` call-sites discovered in the file, recorded by
   * the factory name and the type-argument identifier. The cross-file rule
   * `MODEL_SUBOBJECT_NOT_TAGGED` resolves the type-arg name against every
   * interface declared in the validated source set and warns when the
   * referenced interface carries neither `@dbxModel` nor
   * `@dbxModelSubObject`.
   */
  readonly subObjectCalls: readonly ExtractedSubObjectFactoryCall[];
}

/**
 * Canonical sub-object factory names whose `<T>` type-argument is
 * subject to the `MODEL_SUBOBJECT_NOT_TAGGED` rule. Hardcoded to the
 * `@dereekb/firebase` sub-object family; downstream-registered variants
 * are out of scope (the rule short-circuits silently when it cannot
 * resolve the type-arg in the supplied source set).
 */
export const SUB_OBJECT_FACTORY_NAMES = ['firestoreSubObject', 'firestoreObjectArray', 'firestoreMap'] as const;

export type SubObjectFactoryName = (typeof SUB_OBJECT_FACTORY_NAMES)[number];

/**
 * One call site of `firestoreSubObject<T>(...)`,
 * `firestoreObjectArray<T>(...)`, or `firestoreMap<T>(...)`. Only
 * recorded when the type-arg is a bare type-reference identifier — inline
 * object types, generic parameters, and other shapes are skipped because
 * they never resolve to a declared interface.
 */
export interface ExtractedSubObjectFactoryCall {
  readonly factoryName: SubObjectFactoryName;
  /**
   * The bare identifier text of the first generic type-argument (e.g.
   * `WorkerPayStubItem`). Resolution against declared interfaces happens
   * at the rules layer via the cross-file index.
   */
  readonly typeArgName: string;
  readonly line: number;
}

/**
 * Cross-file context threaded through {@link runRules} so a rule can
 * resolve interface names referenced from one file against declarations
 * in another file of the same validated source set.
 *
 * Both fields are read by the rule layer; `emittedSubObjectInterfaces` is
 * mutated to de-duplicate `MODEL_SUBOBJECT_NOT_TAGGED` emissions across
 * all files (an untagged sub-object referenced from N call-sites only
 * warns once).
 */
export interface CrossFileRuleContext {
  /**
   * Index of every {@link ExtractedDataInterface} declared in the
   * validated source set, keyed by interface name. Names are assumed
   * unique within a model folder (the validator's scope); when two files
   * declare interfaces sharing a name, the first one wins.
   */
  readonly interfacesByName: ReadonlyMap<string, CrossFileInterfaceEntry>;
  /**
   * Mutable set of interface names already emitted as
   * `MODEL_SUBOBJECT_NOT_TAGGED` during this validation run. Shared
   * across all files so a single untagged interface referenced from many
   * call-sites only produces one finding.
   */
  readonly emittedSubObjectInterfaces: Set<string>;
}

export interface CrossFileInterfaceEntry {
  readonly file: string;
  readonly iface: ExtractedDataInterface;
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
  /**
   * `true` when the interface declaration's JSDoc carries an
   * `@dbxModelSubObject` tag. Embedded sub-object interfaces marked with
   * this tag are subject to the same per-field `@dbxModelVariable`
   * long-name rules as `@dbxModel` interfaces, even though they have no
   * `firestoreModelIdentity`.
   */
  readonly dbxModelSubObjectTag: boolean;
  /**
   * Names of the interfaces this interface `extends`. Captured as bare
   * identifiers as written in source (e.g. `WorkerPayStubCostItem`,
   * `IndexRef`); cross-file resolution to a declared
   * {@link ExtractedDataInterface} happens at the rules layer via the
   * {@link CrossFileRuleContext}.
   */
  readonly extendsNames: readonly string[];
  readonly fields: readonly ExtractedField[];
  /**
   * Every `@dbxModelArchetype <slug>[ axisKey=val,...]` tag found on this
   * interface, in source order. Empty when the interface carries no archetype
   * override. Captured here so per-file rules can cross-reference the
   * composite-key tag against the declared archetypes.
   */
  readonly dbxModelArchetypeTags: readonly ExtractedArchetypeTagInfo[];
  /**
   * Parsed `@dbxModelCompositeKey from=... encoding=...` tag (at most one
   * per interface). `undefined` when no tag is present. The validator
   * inspects the captured `from` and `encoding` fields to emit
   * `MODEL_COMPOSITE_KEY_*` findings; the tag's source line is preserved
   * so violations anchor at the tag, not the interface declaration.
   */
  readonly dbxModelCompositeKeyTag?: ExtractedCompositeKeyTagInfo;
}

/**
 * One `@dbxModelArchetype` tag occurrence on an interface, captured by the
 * validator's extractor. Distinct from {@link ExtractedArchetypeTag} (used by
 * the rich model registry) because the validator additionally needs the tag's
 * source line for anchored violations.
 */
export interface ExtractedArchetypeTagInfo {
  readonly slug: string;
  readonly axes: { readonly [key: string]: string };
  readonly line: number;
}

/**
 * Parsed `@dbxModelCompositeKey` tag for the validator. `from` is `'*'` for
 * the wildcard form, or an ordered list of source-model names. Mixed (`'*'`
 * present alongside concrete entries) preserves the literal list so the
 * `MODEL_COMPOSITE_KEY_WILDCARD_MIXED` rule can flag it. `encoding` is
 * `undefined` when missing or invalid — flagged by
 * `MODEL_COMPOSITE_KEY_INVALID_ENCODING`.
 */
export interface ExtractedCompositeKeyTagInfo {
  readonly from: readonly string[] | '*';
  readonly encoding: 'two-way' | 'one-way' | undefined;
  readonly line: number;
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
