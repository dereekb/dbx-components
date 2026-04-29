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

// MARK: Filters
export { FILTER_KIND_ORDER, createFilterRegistry, createFilterRegistryFromEntries, EMPTY_FILTER_REGISTRY, toFilterEntryInfo } from './filters-runtime.js';
export type { FilterRegistry, FilterEntryInfo, FilterEntryInputInfo, FilterKind } from './filters-runtime.js';

// MARK: Firebase Models
import { FIREBASE_MODELS, FIREBASE_MODEL_GROUPS, type FirebaseModel, type FirebaseModelGroup } from './firebase-models.js';

export { FIREBASE_MODELS, FIREBASE_MODEL_GROUPS } from './firebase-models.js';
export type { FirebaseModel, FirebaseModelGroup, FirebaseEnum, FirebaseEnumValue, FirebaseField } from './firebase-models.js';

// MARK: Downstream Firebase Models (runtime)
export { getDownstreamCatalog, clearDownstreamCatalogCache } from './downstream-models-runtime.js';
export type { DownstreamCatalog, DownstreamCatalogError, GetDownstreamCatalogInput } from './downstream-models-runtime.js';
export type { DownstreamFirebasePackage } from '../scan/discover-firebase-packages.js';

/**
 * Returns every registered Firebase model entry.
 *
 * @returns the full Firebase model registry list in declaration order
 */
export function getFirebaseModels(): readonly FirebaseModel[] {
  return FIREBASE_MODELS;
}

/**
 * Looks up a model by its interface name (`'StorageFile'`) or identity const
 * (`'storageFileIdentity'`). Case-insensitive.
 *
 * @param key - the interface name, identity const, or model type to resolve
 * @returns the matching model entry, or `undefined` when no candidate matches
 */
export function getFirebaseModel(key: string): FirebaseModel | undefined {
  const lowered = key.toLowerCase();
  return FIREBASE_MODELS.find((m) => m.name.toLowerCase() === lowered || m.identityConst.toLowerCase() === lowered || m.modelType.toLowerCase() === lowered);
}

/**
 * PRIMARY INDEX. Returns the model with the given collection prefix
 * (`'sf'` → StorageFile). Case-insensitive exact match.
 *
 * @param prefix - the short collection prefix used by the model
 * @returns the matching model entry, or `undefined` when no model uses the prefix
 */
export function getFirebaseModelByPrefix(prefix: string): FirebaseModel | undefined {
  const lowered = prefix.toLowerCase();
  return FIREBASE_MODELS.find((m) => m.collectionPrefix.toLowerCase() === lowered);
}

/**
 * Returns every subcollection model whose parent identity matches
 * `parentIdentityConst` (e.g. `'notificationBoxIdentity'`).
 *
 * @param parentIdentityConst - identity const of the parent collection to scan beneath
 * @returns each subcollection model nested under the given parent, in registry order
 */
export function getFirebaseSubcollectionsOf(parentIdentityConst: string): readonly FirebaseModel[] {
  return FIREBASE_MODELS.filter((m) => m.parentIdentityConst === parentIdentityConst);
}

/**
 * Returns the catalog of distinct collection prefixes in the registry.
 *
 * @returns the unique set of collection prefixes, sorted alphabetically
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
 * @returns the full model-group registry list in declaration order
 */
export function getFirebaseModelGroups(): readonly FirebaseModelGroup[] {
  return FIREBASE_MODEL_GROUPS;
}

/**
 * Looks up a model group by its `<Name>FirestoreCollections` class/interface
 * name (e.g. `'NotificationFirestoreCollections'`). Case-insensitive.
 *
 * @param name - the group container name to resolve
 * @returns the matching group entry, or `undefined` when no group matches
 */
export function getFirebaseModelGroup(name: string): FirebaseModelGroup | undefined {
  const lowered = name.toLowerCase();
  return FIREBASE_MODEL_GROUPS.find((g) => g.name.toLowerCase() === lowered);
}
