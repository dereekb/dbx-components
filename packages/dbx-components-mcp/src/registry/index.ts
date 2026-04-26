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
 *   - model-pointers     lightweight source-file pointers used by the decode tool
 *   - server-actions     callable / on-call / scheduled / event pipeline patterns
 *   - component-patterns action, list, and store patterns
 *   - conventions        TypeScript coding standards and semantic type catalog
 */

export interface PropertyInfo {
  readonly name: string;
  readonly type: string;
  readonly description: string;
  readonly required: boolean;
  readonly default?: unknown;
}

// MARK: Form Fields
import { FORM_FIELDS, type FormFieldInfo, type FormTier, type FormArrayOutput } from './form-fields.js';

export { FORM_FIELDS, FORM_TIER_ORDER } from './form-fields.js';
export type { FormFieldInfo, FormFieldFactoryInfo, FormCompositeBuilderInfo, FormPrimitiveInfo, FormTier, FormFieldWrapperPattern, FormCompositeSuffix, FormLayoutPrimitive, FormArrayOutput } from './form-fields.js';

/**
 * Returns every registered form entry (factories, composites, primitives).
 *
 * @returns the full registry list in declaration order
 */
export function getFormFields(): readonly FormFieldInfo[] {
  return FORM_FIELDS;
}

/**
 * Looks up a form entry by its registry slug (e.g. `'text'`) or by factory
 * name (e.g. `'dbxForgeTextField'`). Factory-name lookup is case insensitive;
 * slug lookup is exact.
 *
 * @param key - registry slug or factory name to look up
 * @returns the matching field, or `undefined` when no entry resolves
 */
export function getFormField(key: string): FormFieldInfo | undefined {
  let result = FORM_FIELDS.find((f) => f.slug === key);
  if (!result) {
    const lowered = key.toLowerCase();
    result = FORM_FIELDS.find((f) => f.factoryName.toLowerCase() === lowered);
  }
  return result;
}

/**
 * PRIMARY index. Returns every form entry whose `produces` matches `value`.
 *
 * Examples:
 *   `getFormFieldsByProduces('string')` → text, text-area, searchable-text, ...
 *   `getFormFieldsByProduces('Date')`   → date, date-time
 *   `getFormFieldsByProduces('RowField')` → row (primitive) + date-range-row (composite)
 *
 * @param value - the produced output type to filter by
 * @returns every entry that produces the requested output, in registry order
 */
export function getFormFieldsByProduces(value: string): readonly FormFieldInfo[] {
  return FORM_FIELDS.filter((f) => f.produces === value);
}

/**
 * Returns every distinct `produces` value present in the registry. Useful for
 * listing available output primitives to callers that want to pick one before
 * querying.
 *
 * @returns the unique set of `produces` values, sorted alphabetically
 */
export function getFormProducesCatalog(): readonly string[] {
  const set = new Set<string>();
  for (const field of FORM_FIELDS) {
    set.add(field.produces);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Filters form entries by {@link FormTier}.
 *
 * @param tier - tier slot to restrict the list to
 * @returns entries whose tier matches, in registry order
 */
export function getFormFieldsByTier(tier: FormTier): readonly FormFieldInfo[] {
  return FORM_FIELDS.filter((f) => f.tier === tier);
}

/**
 * Filters form entries by whether their output is an array (`'yes'`),
 * single value (`'no'`), or configurable (`'optional'`).
 *
 * @param arrayOutput - the array-output classification to filter by
 * @returns entries whose array-output flag matches, in registry order
 */
export function getFormFieldsByArrayOutput(arrayOutput: FormArrayOutput): readonly FormFieldInfo[] {
  return FORM_FIELDS.filter((f) => f.arrayOutput === arrayOutput);
}

// MARK: Actions
import { ACTION_ENTRIES, ACTION_STATE_VALUES, type ActionEntryInfo, type ActionDirectiveInfo, type ActionStateInfo, type ActionEntryRole } from './actions.js';

export { ACTION_ENTRIES, ACTION_ROLE_ORDER, ACTION_STATE_VALUES } from './actions.js';
export type { ActionEntryInfo, ActionDirectiveInfo, ActionStoreInfo, ActionStateInfo, ActionEntryRole, ActionInputInfo, ActionOutputInfo, ActionMethodInfo, ActionObservableInfo, DbxActionStateValue } from './actions.js';

/**
 * Returns every registered action entry (directives + store + states).
 *
 * @returns the full action registry list in declaration order
 */
export function getActionEntries(): readonly ActionEntryInfo[] {
  return ACTION_ENTRIES;
}

/**
 * Looks up a single action entry by its registry slug. Slugs are unique across
 * roles, so one match is the most that ever comes back.
 *
 * @param key - registry slug to resolve
 * @returns the matching entry, or `undefined` when no slug matches
 */
export function getActionEntry(key: string): ActionEntryInfo | undefined {
  const lowered = key.trim().toLowerCase();
  return ACTION_ENTRIES.find((e) => e.slug === lowered);
}

/**
 * Filters action entries by role. Order within a role is preserved from the
 * registry definition.
 *
 * @param role - role classification (`'directive'`, `'store'`, `'state'`) to filter by
 * @returns entries that share the given role, in registry order
 */
export function getActionEntriesByRole(role: ActionEntryRole): readonly ActionEntryInfo[] {
  return ACTION_ENTRIES.filter((e) => e.role === role);
}

/**
 * Looks up a directive entry by its raw `@Directive` selector. Matches against
 * any of the comma-separated selector tokens (e.g. `'dbx-action,[dbxAction]'`
 * resolves on either form). The lookup also tolerates the bracket-less form
 * (e.g. `'dbxActionHandler'` for `'[dbxActionHandler]'`).
 *
 * @param selector - the selector string to resolve, with or without brackets
 * @returns the matching directive entry, or `undefined` when no entry matches
 */
export function getActionDirectiveBySelector(selector: string): ActionDirectiveInfo | undefined {
  const lowered = selector.trim().toLowerCase();
  const candidates = [lowered, `[${lowered}]`];
  let result: ActionDirectiveInfo | undefined;
  for (const entry of ACTION_ENTRIES) {
    if (entry.role !== 'directive') {
      continue;
    }
    const tokens = entry.selector
      .toLowerCase()
      .split(',')
      .map((t) => t.trim());
    if (candidates.some((c) => tokens.includes(c))) {
      result = entry;
      break;
    }
  }
  return result;
}

/**
 * Looks up an entry by its `className` (`'DbxActionHandlerDirective'`,
 * `'ActionContextStore'`). Case-insensitive exact match.
 *
 * @param className - the directive or store class name to resolve
 * @returns the matching entry, or `undefined` when no entry matches
 */
export function getActionEntryByClassName(className: string): ActionEntryInfo | undefined {
  const lowered = className.trim().toLowerCase();
  return ACTION_ENTRIES.find((entry) => {
    let match = false;
    if (entry.role === 'directive' || entry.role === 'store') {
      match = entry.className.toLowerCase() === lowered;
    }
    return match;
  });
}

/**
 * Looks up the {@link ActionStateInfo} entry for a `DbxActionState` enum
 * member name (`'IDLE'`, `'TRIGGERED'`, ...). Case-insensitive.
 *
 * @param stateValue - the enum member name to look up
 * @returns the matching state entry, or `undefined` when the name is unknown
 */
export function getActionStateEntry(stateValue: string): ActionStateInfo | undefined {
  const upper = stateValue.trim().toUpperCase();
  const matched = ACTION_STATE_VALUES.find((v) => v === upper);
  let result: ActionStateInfo | undefined;
  if (matched) {
    result = ACTION_ENTRIES.find((e): e is ActionStateInfo => e.role === 'state' && e.stateValue === matched);
  }
  return result;
}

// MARK: UI Components
import { UI_COMPONENTS, type UiComponentInfo, type UiComponentCategory, type UiComponentKind } from './ui-components.js';

export { UI_COMPONENTS, UI_CATEGORY_ORDER, UI_KIND_ORDER } from './ui-components.js';
export type { UiComponentInfo, UiComponentCategory, UiComponentKind, UiComponentInputInfo, UiComponentOutputInfo } from './ui-components.js';

/**
 * Returns every registered UI component / directive / pipe / service.
 *
 * @returns the full UI registry list in declaration order
 */
export function getUiComponents(): readonly UiComponentInfo[] {
  return UI_COMPONENTS;
}

/**
 * Looks up a UI entry by slug (`'section'`), class name (`'DbxSectionComponent'`),
 * or selector substring (`'dbx-section'`). Slug match is exact; className is
 * case-insensitive; selector match is exact against any comma-separated piece
 * of the entry's selector string.
 *
 * @param key - slug, class name, or selector to resolve against the registry
 * @returns the matching entry, or `undefined` when no candidate matches
 */
export function getUiComponent(key: string): UiComponentInfo | undefined {
  const direct = UI_COMPONENTS.find((c) => c.slug === key);
  let result: UiComponentInfo | undefined = direct;
  if (!result) {
    const lowered = key.toLowerCase();
    result = UI_COMPONENTS.find((c) => c.className.toLowerCase() === lowered);
  }
  if (!result) {
    result = getUiComponentBySelector(key);
  }
  return result;
}

/**
 * PRIMARY index. Returns every UI entry whose `category` matches the given value.
 *
 * @param category - the category to filter by
 * @returns entries that share the given category, in registry order
 */
export function getUiComponentsByCategory(category: UiComponentCategory): readonly UiComponentInfo[] {
  return UI_COMPONENTS.filter((c) => c.category === category);
}

/**
 * Returns every UI entry whose `kind` matches the given value.
 *
 * @param kind - the kind classification (component, directive, pipe, service) to filter by
 * @returns entries that share the given kind, in registry order
 */
export function getUiComponentsByKind(kind: UiComponentKind): readonly UiComponentInfo[] {
  return UI_COMPONENTS.filter((c) => c.kind === kind);
}

/**
 * Looks up a UI entry by selector. Splits comma-separated selector strings and
 * matches each piece individually so callers can pass either the element form
 * (`'dbx-section'`) or the attribute form (`'[dbxContent]'`).
 *
 * @param selector - the element or attribute selector to resolve
 * @returns the matching UI entry, or `undefined` when no piece matches
 */
export function getUiComponentBySelector(selector: string): UiComponentInfo | undefined {
  const target = selector.trim();
  return UI_COMPONENTS.find((c) => {
    const pieces = c.selector.split(',').map((s) => s.trim());
    return pieces.includes(target);
  });
}

// MARK: Firebase Models
import { FIREBASE_MODELS, type FirebaseModel } from './firebase-models.js';

export { FIREBASE_MODELS } from './firebase-models.js';
export type { FirebaseModel, FirebaseEnum, FirebaseEnumValue, FirebaseField } from './firebase-models.js';

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
