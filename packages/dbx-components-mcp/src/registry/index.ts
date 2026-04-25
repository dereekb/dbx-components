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
 */
export function getFormFields(): readonly FormFieldInfo[] {
  return FORM_FIELDS;
}

/**
 * Looks up a form entry by its registry slug (e.g. `'text'`) or by factory
 * name (e.g. `'dbxForgeTextField'`). Factory-name lookup is case insensitive;
 * slug lookup is exact.
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
 */
export function getFormFieldsByProduces(value: string): readonly FormFieldInfo[] {
  return FORM_FIELDS.filter((f) => f.produces === value);
}

/**
 * Returns every distinct `produces` value present in the registry. Useful for
 * listing available output primitives to callers that want to pick one before
 * querying.
 */
export function getFormProducesCatalog(): readonly string[] {
  const set = new Set<string>();
  for (const field of FORM_FIELDS) {
    set.add(field.produces);
  }
  const result = Array.from(set).sort();
  return result;
}

/**
 * Filters form entries by {@link FormTier}.
 */
export function getFormFieldsByTier(tier: FormTier): readonly FormFieldInfo[] {
  return FORM_FIELDS.filter((f) => f.tier === tier);
}

/**
 * Filters form entries by whether their output is an array (`'yes'`),
 * single value (`'no'`), or configurable (`'optional'`).
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
 */
export function getActionEntries(): readonly ActionEntryInfo[] {
  return ACTION_ENTRIES;
}

/**
 * Looks up a single action entry by its registry slug. Slugs are unique across
 * roles, so one match is the most that ever comes back.
 */
export function getActionEntry(key: string): ActionEntryInfo | undefined {
  const lowered = key.trim().toLowerCase();
  const result = ACTION_ENTRIES.find((e) => e.slug === lowered);
  return result;
}

/**
 * Filters action entries by role. Order within a role is preserved from the
 * registry definition.
 */
export function getActionEntriesByRole(role: ActionEntryRole): readonly ActionEntryInfo[] {
  return ACTION_ENTRIES.filter((e) => e.role === role);
}

/**
 * Looks up a directive entry by its raw `@Directive` selector. Matches against
 * any of the comma-separated selector tokens (e.g. `'dbx-action,[dbxAction]'`
 * resolves on either form). The lookup also tolerates the bracket-less form
 * (e.g. `'dbxActionHandler'` for `'[dbxActionHandler]'`).
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
 */
export function getActionEntryByClassName(className: string): ActionEntryInfo | undefined {
  const lowered = className.trim().toLowerCase();
  const result = ACTION_ENTRIES.find((entry) => {
    let match = false;
    if (entry.role === 'directive' || entry.role === 'store') {
      match = entry.className.toLowerCase() === lowered;
    }
    return match;
  });
  return result;
}

/**
 * Looks up the {@link ActionStateInfo} entry for a `DbxActionState` enum
 * member name (`'IDLE'`, `'TRIGGERED'`, ...). Case-insensitive.
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
 */
export function getUiComponents(): readonly UiComponentInfo[] {
  return UI_COMPONENTS;
}

/**
 * Looks up a UI entry by slug (`'section'`), class name (`'DbxSectionComponent'`),
 * or selector substring (`'dbx-section'`). Slug match is exact; className is
 * case-insensitive; selector match is exact against any comma-separated piece
 * of the entry's selector string.
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
 */
export function getUiComponentsByCategory(category: UiComponentCategory): readonly UiComponentInfo[] {
  return UI_COMPONENTS.filter((c) => c.category === category);
}

/**
 * Returns every UI entry whose `kind` matches the given value.
 */
export function getUiComponentsByKind(kind: UiComponentKind): readonly UiComponentInfo[] {
  return UI_COMPONENTS.filter((c) => c.kind === kind);
}

/**
 * Looks up a UI entry by selector. Splits comma-separated selector strings and
 * matches each piece individually so callers can pass either the element form
 * (`'dbx-section'`) or the attribute form (`'[dbxContent]'`).
 */
export function getUiComponentBySelector(selector: string): UiComponentInfo | undefined {
  const target = selector.trim();
  const result = UI_COMPONENTS.find((c) => {
    const pieces = c.selector.split(',').map((s) => s.trim());
    return pieces.includes(target);
  });
  return result;
}

// MARK: Firebase Models
import { FIREBASE_MODELS, type FirebaseModel } from './firebase-models.js';

export { FIREBASE_MODELS } from './firebase-models.js';
export type { FirebaseModel, FirebaseEnum, FirebaseEnumValue, FirebaseField } from './firebase-models.js';

/**
 * Returns every registered Firebase model entry.
 */
export function getFirebaseModels(): readonly FirebaseModel[] {
  return FIREBASE_MODELS;
}

/**
 * Looks up a model by its interface name (`'StorageFile'`) or identity const
 * (`'storageFileIdentity'`). Case-insensitive.
 */
export function getFirebaseModel(key: string): FirebaseModel | undefined {
  const lowered = key.toLowerCase();
  const result = FIREBASE_MODELS.find((m) => m.name.toLowerCase() === lowered || m.identityConst.toLowerCase() === lowered || m.modelType.toLowerCase() === lowered);
  return result;
}

/**
 * PRIMARY INDEX. Returns the model with the given collection prefix
 * (`'sf'` → StorageFile). Case-insensitive exact match.
 */
export function getFirebaseModelByPrefix(prefix: string): FirebaseModel | undefined {
  const lowered = prefix.toLowerCase();
  const result = FIREBASE_MODELS.find((m) => m.collectionPrefix.toLowerCase() === lowered);
  return result;
}

/**
 * Returns every subcollection model whose parent identity matches
 * `parentIdentityConst` (e.g. `'notificationBoxIdentity'`).
 */
export function getFirebaseSubcollectionsOf(parentIdentityConst: string): readonly FirebaseModel[] {
  return FIREBASE_MODELS.filter((m) => m.parentIdentityConst === parentIdentityConst);
}

/**
 * Returns the catalog of distinct collection prefixes in the registry.
 */
export function getFirebasePrefixCatalog(): readonly string[] {
  const set = new Set<string>();
  for (const model of FIREBASE_MODELS) {
    set.add(model.collectionPrefix);
  }
  const result = Array.from(set).sort();
  return result;
}
