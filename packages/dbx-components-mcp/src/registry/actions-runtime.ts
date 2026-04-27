/**
 * Actions runtime registry wrapper.
 *
 * Wraps the raw {@link LoadActionManifestsResult} produced by the loader
 * with domain-friendly accessors so the lookup tool and the registry
 * resource don't have to walk Maps directly.
 *
 * Manifest entries (flat, JSON-friendly shape) are converted into the
 * `ActionEntryInfo` discriminated union historically exposed by
 * `registry/actions.ts`. The lookup tool keeps consuming that shape so
 * this module is the only seam that changed when the hand-written entries
 * were deleted.
 */

import type { LoadActionManifestsResult } from '../manifest/actions-loader.js';
import type { ActionDirectiveEntry, ActionEntry, ActionStateEntry, ActionStoreEntry, DbxActionStateValue } from '../manifest/actions-schema.js';

// MARK: Public types
/**
 * Three roles share a slug index but differ in payload.
 */
export type ActionEntryRole = 'directive' | 'store' | 'state';

/**
 * Stable rendering order for role buckets in the catalog view.
 */
export const ACTION_ROLE_ORDER: readonly ActionEntryRole[] = ['directive', 'store', 'state'];

/**
 * Common base fields shared across all three entry shapes.
 */
export interface ActionEntryBase {
  readonly slug: string;
  readonly role: ActionEntryRole;
  readonly description: string;
  readonly skillRefs: readonly string[];
  readonly sourcePath: string;
  readonly example: string;
}

/**
 * One input on a directive.
 */
export interface ActionInputInfo {
  readonly alias: string;
  readonly propertyName: string;
  readonly type: string;
  readonly required: boolean;
  readonly defaultValue?: string;
  readonly description: string;
}

/**
 * One output / event emitter on a directive.
 */
export interface ActionOutputInfo {
  readonly name: string;
  readonly type: string;
  readonly description: string;
}

/**
 * Method exposed by a store entry.
 */
export interface ActionMethodInfo {
  readonly name: string;
  readonly signature: string;
  readonly description: string;
}

/**
 * Observable exposed by a store entry.
 */
export interface ActionObservableInfo {
  readonly name: string;
  readonly type: string;
  readonly description: string;
}

/**
 * Directive entry. Captures selector + class + DI behavior + the action
 * states the directive interacts with.
 */
export interface ActionDirectiveInfo extends ActionEntryBase {
  readonly role: 'directive';
  readonly selector: string;
  readonly className: string;
  readonly module: string;
  readonly inputs: readonly ActionInputInfo[];
  readonly outputs: readonly ActionOutputInfo[];
  readonly producesContext: boolean;
  readonly consumesContext: boolean;
  readonly stateInteraction: readonly DbxActionStateValue[];
}

/**
 * Store entry. There is exactly one in the registry today
 * (`ActionContextStore`), but the shape allows derivative stores to join.
 */
export interface ActionStoreInfo extends ActionEntryBase {
  readonly role: 'store';
  readonly className: string;
  readonly module: string;
  readonly methods: readonly ActionMethodInfo[];
  readonly observables: readonly ActionObservableInfo[];
  readonly disabledKeyDefaults: readonly string[];
}

/**
 * State entry — one per member of the `DbxActionState` enum.
 */
export interface ActionStateInfo extends ActionEntryBase {
  readonly role: 'state';
  readonly enumName: 'DbxActionState';
  readonly stateValue: DbxActionStateValue;
  readonly literal: string;
  readonly module: string;
  readonly transitionsFrom: readonly DbxActionStateValue[];
  readonly transitionsTo: readonly DbxActionStateValue[];
}

/**
 * Discriminated union exposed to the lookup tool.
 */
export type ActionEntryInfo = ActionDirectiveInfo | ActionStoreInfo | ActionStateInfo;

/**
 * Domain-friendly read API over a merged actions manifest set.
 */
export interface ActionRegistry {
  readonly all: readonly ActionEntryInfo[];
  readonly loadedSources: readonly string[];
  readonly roles: readonly ActionEntryRole[];
  /**
   * Returns the entry whose slug matches `slug` exactly.
   */
  findBySlug(slug: string): ActionEntryInfo | undefined;
  /**
   * Returns the directive entry whose selector matches `selector` exactly.
   */
  findDirectiveBySelector(selector: string): ActionDirectiveInfo | undefined;
  /**
   * Returns the entry whose TypeScript class name matches `className`
   * (case-insensitive).
   */
  findByClassName(className: string): ActionEntryInfo | undefined;
  /**
   * Returns the state entry whose `stateValue` matches.
   */
  findStateByValue(stateValue: DbxActionStateValue): ActionStateInfo | undefined;
  /**
   * Returns every entry in the supplied role, in registry order.
   */
  findByRole(role: ActionEntryRole): readonly ActionEntryInfo[];
}

// MARK: Construction
/**
 * Builds an {@link ActionRegistry} from a loader result.
 */
export function createActionRegistry(loaded: LoadActionManifestsResult): ActionRegistry {
  const entries = Array.from(loaded.entries.values()).map(toActionEntryInfo);
  return createActionRegistryFromEntries({ entries, loadedSources: loaded.loadedSources });
}

/**
 * Builds an {@link ActionRegistry} from a raw {@link ActionEntryInfo} array.
 */
export function createActionRegistryFromEntries(input: { readonly entries: readonly ActionEntryInfo[]; readonly loadedSources: readonly string[] }): ActionRegistry {
  const all = [...input.entries];

  const bySlug = new Map<string, ActionEntryInfo>();
  const byClassName = new Map<string, ActionEntryInfo>();
  const byRole = new Map<ActionEntryRole, ActionEntryInfo[]>();
  const directiveBySelector = new Map<string, ActionDirectiveInfo>();
  const stateByValue = new Map<DbxActionStateValue, ActionStateInfo>();
  const roleSet = new Set<ActionEntryRole>();

  for (const entry of all) {
    if (!bySlug.has(entry.slug)) {
      bySlug.set(entry.slug, entry);
    }
    if (entry.role === 'directive' || entry.role === 'store') {
      const classKey = entry.className.toLowerCase();
      if (!byClassName.has(classKey)) {
        byClassName.set(classKey, entry);
      }
    }
    if (entry.role === 'directive') {
      for (const selector of entry.selector.split(',')) {
        const trimmed = selector.trim();
        if (trimmed.length > 0 && !directiveBySelector.has(trimmed)) {
          directiveBySelector.set(trimmed, entry);
        }
      }
    }
    if (entry.role === 'state') {
      stateByValue.set(entry.stateValue, entry);
    }
    pushInto(byRole, entry.role, entry);
    roleSet.add(entry.role);
  }

  const roles = ACTION_ROLE_ORDER.filter((r) => roleSet.has(r));

  const registry: ActionRegistry = {
    all,
    loadedSources: [...input.loadedSources],
    roles,
    findBySlug(slug) {
      return bySlug.get(slug);
    },
    findDirectiveBySelector(selector) {
      return directiveBySelector.get(selector.trim());
    },
    findByClassName(className) {
      return byClassName.get(className.toLowerCase());
    },
    findStateByValue(stateValue) {
      return stateByValue.get(stateValue);
    },
    findByRole(role) {
      return byRole.get(role) ?? [];
    }
  };
  return registry;
}

/**
 * Empty registry for default-no-source scenarios.
 */
export const EMPTY_ACTION_REGISTRY: ActionRegistry = createActionRegistryFromEntries({ entries: [], loadedSources: [] });

// MARK: Manifest → runtime conversion
/**
 * Converts a manifest entry into the {@link ActionEntryInfo} shape the
 * lookup tool consumes.
 */
export function toActionEntryInfo(entry: ActionEntry): ActionEntryInfo {
  let result: ActionEntryInfo;
  switch (entry.role) {
    case 'directive':
      result = directiveFromManifest(entry);
      break;
    case 'store':
      result = storeFromManifest(entry);
      break;
    case 'state':
      result = stateFromManifest(entry);
      break;
  }
  return result;
}

function directiveFromManifest(entry: ActionDirectiveEntry): ActionDirectiveInfo {
  return {
    role: 'directive',
    slug: entry.slug,
    selector: entry.selector,
    className: entry.className,
    module: entry.module,
    description: entry.description,
    skillRefs: [...entry.skillRefs],
    sourcePath: entry.sourcePath,
    inputs: entry.inputs.map((i) => ({ ...i })),
    outputs: entry.outputs.map((o) => ({ ...o })),
    producesContext: entry.producesContext,
    consumesContext: entry.consumesContext,
    stateInteraction: [...entry.stateInteraction],
    example: entry.example
  };
}

function storeFromManifest(entry: ActionStoreEntry): ActionStoreInfo {
  return {
    role: 'store',
    slug: entry.slug,
    className: entry.className,
    module: entry.module,
    description: entry.description,
    skillRefs: [...entry.skillRefs],
    sourcePath: entry.sourcePath,
    methods: entry.methods.map((m) => ({ ...m })),
    observables: entry.observables.map((o) => ({ ...o })),
    disabledKeyDefaults: [...entry.disabledKeyDefaults],
    example: entry.example
  };
}

function stateFromManifest(entry: ActionStateEntry): ActionStateInfo {
  return {
    role: 'state',
    slug: entry.slug,
    enumName: 'DbxActionState',
    stateValue: entry.stateValue,
    literal: entry.literal,
    module: entry.module,
    description: entry.description,
    skillRefs: [...entry.skillRefs],
    sourcePath: entry.sourcePath,
    transitionsFrom: [...entry.transitionsFrom],
    transitionsTo: [...entry.transitionsTo],
    example: entry.example
  };
}

// MARK: Internals
function pushInto<K>(map: Map<K, ActionEntryInfo[]>, key: K, entry: ActionEntryInfo): void {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, [entry]);
  } else {
    existing.push(entry);
  }
}
