/**
 * Registry barrel for dbx-components domains.
 *
 * Each domain exports typed metadata constants (plain TypeScript, no state)
 * plus pure getter functions. Domains are populated incrementally — see the
 * implementation plan in the feat/dbx-components-mcp branch.
 *
 * Planned domains:
 *   - form-fields       field factories, composite builders, and layout primitives
 *   - firebase-models    model identity, data interfaces, converters, collection patterns
 *   - semantic-types     domain-meaningful type aliases tagged with @semanticType (loaded at runtime)
 *   - model-pointers     lightweight source-file pointers used by the decode tool
 *   - server-actions     callable / on-call / scheduled / event pipeline patterns
 *   - component-patterns action, list, and store patterns
 *   - conventions        TypeScript coding standards and semantic type catalog
 */

export { createSemanticTypeRegistry, createSemanticTypeRegistryFromEntries, EMPTY_SEMANTIC_TYPE_REGISTRY } from './semantic-types.js';
export type { SemanticTypeRegistry } from './semantic-types.js';

export interface PropertyInfo {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly required: boolean;
  readonly default?: unknown;
}

// MARK: Form Fields
export { FORM_FIELDS, FORM_TIER_ORDER } from './form-fields.js';
export type { FormFieldInfo, FormFieldFactoryInfo, FormFieldDerivativeInfo, FormCompositeBuilderInfo, FormFieldTemplateInfo, FormPrimitiveInfo, FormTier, FormFieldWrapperPattern, FormCompositeSuffix, FormLayoutPrimitive, FormArrayOutput } from './form-fields.js';

// MARK: Actions
export { ACTION_ROLE_ORDER, createActionRegistry, createActionRegistryFromEntries, EMPTY_ACTION_REGISTRY, toActionEntryInfo } from './actions-runtime.js';
export type { ActionRegistry, ActionEntryInfo, ActionDirectiveInfo, ActionStoreInfo, ActionStateInfo, ActionEntryRole, ActionInputInfo, ActionOutputInfo, ActionMethodInfo, ActionObservableInfo } from './actions-runtime.js';

// MARK: UI Components
export { createUiComponentRegistry, createUiComponentRegistryFromEntries, EMPTY_UI_COMPONENT_REGISTRY } from './ui-components-runtime.js';
export type { UiComponentRegistry } from './ui-components-runtime.js';

// MARK: CSS Utilities
export { createCssUtilityRegistry, createCssUtilityRegistryFromEntries, EMPTY_CSS_UTILITY_REGISTRY, parseDeclarations } from './css-utilities-runtime.js';
export type { CssUtilityRegistry, ScoredCssUtilityMatch, SearchByDeclarationsOptions, FindByIntentOptions } from './css-utilities-runtime.js';

// MARK: Forge Fields
export { createForgeFieldRegistry, createForgeFieldRegistryFromEntries, EMPTY_FORGE_FIELD_REGISTRY, toFormFieldInfo } from './forge-fields.js';
export type { ForgeFieldRegistry } from './forge-fields.js';

// MARK: Pipes
export { createPipeRegistry, createPipeRegistryFromEntries, EMPTY_PIPE_REGISTRY, PIPE_CATEGORY_ORDER } from './pipes-runtime.js';
export type { PipeRegistry, PipeEntryInfo, PipeCategory } from './pipes-runtime.js';

// MARK: Utils
export { createUtilRegistry, createUtilRegistryFromEntries, EMPTY_UTIL_REGISTRY } from './utils-runtime.js';
export type { UtilRegistry, UtilEntryInfo } from './utils-runtime.js';

// MARK: Tokens
export { createTokenRegistry, createTokenRegistryFromEntries, EMPTY_TOKEN_REGISTRY } from './tokens-runtime.js';
export type { TokenRegistry } from './tokens-runtime.js';

// MARK: Model Snapshot Fields
export { createModelSnapshotFieldRegistry, createModelSnapshotFieldRegistryFromEntries, EMPTY_MODEL_SNAPSHOT_FIELD_REGISTRY } from './model-snapshot-fields-runtime.js';
export type { ModelSnapshotFieldRegistry, ModelSnapshotFieldEntryInfo } from './model-snapshot-fields-runtime.js';

// MARK: DBX Docs UI Examples
export { createDbxDocsUiExamplesRegistry, createDbxDocsUiExamplesRegistryFromEntries, EMPTY_DBX_DOCS_UI_EXAMPLES_REGISTRY } from './dbx-docs-ui-examples-runtime.js';
export type { DbxDocsUiExamplesRegistry } from './dbx-docs-ui-examples-runtime.js';

// MARK: Filters
export { FILTER_KIND_ORDER, createFilterRegistry, createFilterRegistryFromEntries, EMPTY_FILTER_REGISTRY, toFilterEntryInfo } from './filters-runtime.js';
export type { FilterRegistry, FilterEntryInfo, FilterEntryInputInfo, FilterKind } from './filters-runtime.js';

// MARK: Auth
export { createAuthRegistryFromEntries, EMPTY_AUTH_REGISTRY } from './auth-runtime.js';
export type { AuthRegistry, AuthRoleInfo, AuthClaimInfo, AuthClaimRoleMappingInfo, AuthScopeInfo, AuthScopeEnforcementInfo, AuthAppInfo, AuthEntrySource, CreateAuthRegistryFromEntriesInput } from './auth-runtime.js';
export { BUILTIN_AUTH_ROLES, BUILTIN_AUTH_CLAIMS, BUILTIN_AUTH_SCOPES, WORKSPACE_AUTH_CLAIMS, WORKSPACE_AUTH_APPS } from './auth-builtin.js';

// MARK: Firebase Models
import { FIREBASE_MODELS, FIREBASE_MODEL_GROUPS, type FirebaseModel, type FirebaseModelGroup } from './firebase-models.js';

export { FIREBASE_MODELS, FIREBASE_MODEL_GROUPS } from './firebase-models.js';
export type { FirebaseModel, FirebaseModelGroup, FirebaseEnum, FirebaseEnumValue, FirebaseField, FirebaseSubObject, FirestoreCollectionKind } from './firebase-models.js';

// MARK: Reserved Model Folders
export { RESERVED_MODEL_FOLDERS } from './reserved-model-folders.js';
export type { ReservedModelFolder } from './reserved-model-folders.js';

// MARK: Model Archetypes
export { MODEL_ARCHETYPES, MODEL_ARCHETYPE_SYNC_MODES, MODEL_ARCHETYPE_ADDON_SLUGS, getModelArchetypeBySlug, resolveModelArchetype, getModelArchetypesBySyncMode, getModelArchetypesByCollectionKind, getModelArchetypesByAxisValue } from './archetypes.js';
export type { ModelArchetypeInfo, ModelArchetypeSlug, ModelArchetypeSyncMode, ModelArchetypeDocIdSource, ModelArchetypeParentRelation, ModelArchetypeUserRelation, ModelArchetypeMutability, ModelArchetypeSingleItemSubPurpose, ModelArchetypeDenormalisedAggregateKeying, ModelArchetypeExpectedAnswers } from './archetypes.js';

// MARK: Downstream Firebase Models (runtime)
export { getDownstreamCatalog, clearDownstreamCatalogCache } from './downstream-models-runtime.js';
export type { DownstreamCatalog, DownstreamCatalogError, GetDownstreamCatalogInput } from './downstream-models-runtime.js';

/**
 * Returns every registered Firebase model entry.
 *
 * @returns The full Firebase model registry list in declaration order.
 */
export function getFirebaseModels(): readonly FirebaseModel[] {
  return FIREBASE_MODELS;
}

/**
 * Looks up a model by its interface name (`'StorageFile'`) or identity const
 * (`'storageFileIdentity'`). Case-insensitive.
 *
 * @param key - The interface name, identity const, or model type to resolve.
 * @returns The matching model entry, or `undefined` when no candidate matches.
 */
export function getFirebaseModel(key: string): FirebaseModel | undefined {
  const lowered = key.toLowerCase();
  return FIREBASE_MODELS.find((m) => m.name.toLowerCase() === lowered || m.identityConst.toLowerCase() === lowered || m.modelType.toLowerCase() === lowered);
}

/**
 * PRIMARY INDEX. Returns the model with the given collection prefix
 * (`'sf'` → StorageFile). Case-insensitive exact match.
 *
 * @param prefix - The short collection prefix used by the model.
 * @returns The matching model entry, or `undefined` when no model uses the prefix.
 */
export function getFirebaseModelByPrefix(prefix: string): FirebaseModel | undefined {
  const lowered = prefix.toLowerCase();
  return FIREBASE_MODELS.find((m) => m.collectionPrefix.toLowerCase() === lowered);
}

/**
 * Returns every subcollection model whose parent identity matches
 * `parentIdentityConst` (e.g. `'notificationBoxIdentity'`).
 *
 * @param parentIdentityConst - Identity const of the parent collection to scan beneath.
 * @returns Each subcollection model nested under the given parent, in registry order.
 */
export function getFirebaseSubcollectionsOf(parentIdentityConst: string): readonly FirebaseModel[] {
  return FIREBASE_MODELS.filter((m) => m.parentIdentityConst === parentIdentityConst);
}

/**
 * Returns every model whose Firestore document id IS a Firebase Auth user uid
 * — i.e. the interface (or one of its same-file ancestors) extends
 * `UserRelatedById`. Useful for enumerating the per-user document set when
 * reasoning about ownership and permissions.
 *
 * @returns Each user-keyed model in registry order.
 */
export function getFirebaseUserKeyedByIdModels(): readonly FirebaseModel[] {
  return FIREBASE_MODELS.filter((m) => m.userKeyedById === true);
}

/**
 * Returns every model that carries an explicit `uid` field referencing a
 * Firebase Auth user — i.e. the interface (or one of its same-file
 * ancestors) extends `UserRelated`. Independent of
 * {@link getFirebaseUserKeyedByIdModels}: a model can appear in either,
 * both, or neither list.
 *
 * @returns Each user-related model in registry order.
 */
export function getFirebaseUserRelatedModels(): readonly FirebaseModel[] {
  return FIREBASE_MODELS.filter((m) => m.hasUserUidField === true);
}

/**
 * Returns every model whose Firestore document id IS a region key (interface
 * extends `RegionRelatedById`).
 *
 * @returns Each region-keyed model in registry order.
 */
export function getFirebaseRegionKeyedByIdModels(): readonly FirebaseModel[] {
  return FIREBASE_MODELS.filter((m) => m.regionKeyedById === true);
}

/**
 * Returns every model whose Firestore document id IS a district key (interface
 * extends `DistrictRelatedById`).
 *
 * @returns Each district-keyed model in registry order.
 */
export function getFirebaseDistrictKeyedByIdModels(): readonly FirebaseModel[] {
  return FIREBASE_MODELS.filter((m) => m.districtKeyedById === true);
}

/**
 * Returns every model whose Firestore document id IS an external vendor id
 * (interface extends `ExternalRelatedById`).
 *
 * @returns Each external-id-keyed model in registry order.
 */
export function getFirebaseExternalIdKeyedByIdModels(): readonly FirebaseModel[] {
  return FIREBASE_MODELS.filter((m) => m.externalIdKeyedById === true);
}

/**
 * Returns every model whose Firestore document id IS a temporal bucket code
 * (year-week / year-month / …).
 *
 * @returns Each bucket-keyed model in registry order.
 */
export function getFirebaseBucketKeyedByIdModels(): readonly FirebaseModel[] {
  return FIREBASE_MODELS.filter((m) => m.bucketKeyedById === true);
}

/**
 * Returns every model whose `archetype` matches the given slug. Used by
 * `dbx_model_archetype_search` peer search.
 *
 * @param archetype - The archetype slug to filter by.
 * @returns Each matching model in registry order.
 */
export function getFirebaseModelsByArchetype(archetype: string): readonly FirebaseModel[] {
  return FIREBASE_MODELS.filter((m) => m.archetypes?.includes(archetype) === true);
}

/**
 * Returns the catalog of distinct collection prefixes in the registry.
 *
 * @returns The unique set of collection prefixes, sorted alphabetically.
 */
export function getFirebasePrefixCatalog(): readonly string[] {
  const set = new Set<string>();
  for (const model of FIREBASE_MODELS) {
    set.add(model.collectionPrefix);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Returns every registered Firebase model-group container (e.g.
 * `NotificationFirestoreCollections`).
 *
 * @returns The full model-group registry list in declaration order.
 */
export function getFirebaseModelGroups(): readonly FirebaseModelGroup[] {
  return FIREBASE_MODEL_GROUPS;
}

/**
 * Looks up a model group by its `<Name>FirestoreCollections` class/interface
 * name (e.g. `'NotificationFirestoreCollections'`). Case-insensitive.
 *
 * @param name - The group container name to resolve.
 * @returns The matching group entry, or `undefined` when no group matches.
 */
export function getFirebaseModelGroup(name: string): FirebaseModelGroup | undefined {
  const lowered = name.toLowerCase();
  return FIREBASE_MODEL_GROUPS.find((g) => g.name.toLowerCase() === lowered);
}
