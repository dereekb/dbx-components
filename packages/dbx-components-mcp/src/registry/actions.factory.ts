/**
 * Entry factories for the action registry. Each registry entry is still a
 * plain typed object literal — the factory just supplies the role tag, the
 * `@dereekb/dbx-core` module string, and the empty-array defaults so that
 * the entry call sites stay focused on what's actually unique to each
 * directive / store / state.
 */

import type { ActionDirectiveInfo, ActionInputInfo, ActionOutputInfo, ActionStateInfo, ActionStoreInfo, DbxActionStateValue } from './actions.js';

/**
 * Module string shared by every action-registry entry. Centralised here so
 * the factory call sites don't need to import or repeat it.
 */
export const DBX_CORE_MODULE = '@dereekb/dbx-core';

/**
 * Default skill list. Every action-registry entry references the
 * components-patterns skill; entries that need additional refs override it
 * via `skillRefs: [...]` on the factory input.
 */
const DEFAULT_SKILL_REFS: readonly string[] = ['dbx__ref__dbx-component-patterns'];

const STATE_SOURCE_PATH = 'packages/dbx-core/src/lib/action/action.ts';

const NO_INPUTS: readonly ActionInputInfo[] = [];
const NO_OUTPUTS: readonly ActionOutputInfo[] = [];

/**
 * Per-entry fields for {@link actionDirective}. The `role`, `module`, and
 * empty-array fields all have factory-supplied defaults; the rest are
 * required.
 */
export interface ActionDirectiveFactoryInput {
  /**
   * Unique kebab-case slug.
   */
  readonly slug: string;
  /**
   * Full Angular `@Directive` selector string.
   */
  readonly selector: string;
  /**
   * Exported class name.
   */
  readonly className: string;
  /**
   * Prose description of what the entry is and when to reach for it.
   */
  readonly description: string;
  /**
   * Path within the source repository where the directive is defined.
   */
  readonly sourcePath: string;
  /**
   * Copy-paste-ready HTML usage snippet.
   */
  readonly example: string;
  /**
   * Skill slugs to load for further context (defaults to the components-patterns skill).
   */
  readonly skillRefs?: readonly string[];
  /**
   * Inputs the directive accepts (defaults to `[]`).
   */
  readonly inputs?: readonly ActionInputInfo[];
  /**
   * Outputs the directive emits (defaults to `[]` — no current dbx-core action directive emits).
   */
  readonly outputs?: readonly ActionOutputInfo[];
  /**
   * Whether the directive provides a store (defaults to `false`).
   */
  readonly producesContext?: boolean;
  /**
   * Whether the directive injects a store (defaults to `false`).
   */
  readonly consumesContext?: boolean;
  /**
   * Action states the directive reads/writes (defaults to `[]`).
   */
  readonly stateInteraction?: readonly DbxActionStateValue[];
  /**
   * Module the directive ships in (defaults to `@dereekb/dbx-core`).
   */
  readonly module?: string;
}

/**
 * Builds an {@link ActionDirectiveInfo} entry. Factory-supplied defaults
 * cover `role: 'directive'`, `module: '@dereekb/dbx-core'`, the empty-array
 * fields, and `false` for the context flags.
 *
 * @param input - per-entry fields; supply optional fields when the directive
 *   deviates from the empty / `false` defaults
 * @returns the assembled directive entry
 */
export function actionDirective(input: ActionDirectiveFactoryInput): ActionDirectiveInfo {
  return {
    role: 'directive',
    slug: input.slug,
    selector: input.selector,
    className: input.className,
    module: input.module ?? DBX_CORE_MODULE,
    description: input.description,
    skillRefs: input.skillRefs ?? DEFAULT_SKILL_REFS,
    sourcePath: input.sourcePath,
    inputs: input.inputs ?? NO_INPUTS,
    outputs: input.outputs ?? NO_OUTPUTS,
    producesContext: input.producesContext ?? false,
    consumesContext: input.consumesContext ?? false,
    stateInteraction: input.stateInteraction ?? [],
    example: input.example
  };
}

/**
 * Per-entry fields for {@link actionStore}. The `role` and `module` are
 * factory-supplied; the rest are required.
 */
export interface ActionStoreFactoryInput {
  /**
   * Unique kebab-case slug.
   */
  readonly slug: string;
  /**
   * Exported class name.
   */
  readonly className: string;
  /**
   * Prose description of what the store is and when to reach for it.
   */
  readonly description: string;
  /**
   * Path within the source repository where the store is defined.
   */
  readonly sourcePath: string;
  /**
   * Copy-paste-ready TS usage snippet.
   */
  readonly example: string;
  /**
   * Public methods on the store.
   */
  readonly methods: ActionStoreInfo['methods'];
  /**
   * Public observables on the store.
   */
  readonly observables: ActionStoreInfo['observables'];
  /**
   * Common disabled-key constants surfaced by sibling directives.
   */
  readonly disabledKeyDefaults: readonly string[];
  /**
   * Skill slugs to load for further context (defaults to the components-patterns skill).
   */
  readonly skillRefs?: readonly string[];
  /**
   * Module the store ships in (defaults to `@dereekb/dbx-core`).
   */
  readonly module?: string;
}

/**
 * Builds an {@link ActionStoreInfo} entry. Defaults `role` and `module`.
 *
 * @param input - per-entry fields
 * @returns the assembled store entry
 */
export function actionStore(input: ActionStoreFactoryInput): ActionStoreInfo {
  return {
    role: 'store',
    slug: input.slug,
    className: input.className,
    module: input.module ?? DBX_CORE_MODULE,
    description: input.description,
    skillRefs: input.skillRefs ?? DEFAULT_SKILL_REFS,
    sourcePath: input.sourcePath,
    methods: input.methods,
    observables: input.observables,
    disabledKeyDefaults: input.disabledKeyDefaults,
    example: input.example
  };
}

/**
 * Per-entry fields for {@link actionState}. The `role`, `enumName`, `slug`,
 * `example`, `sourcePath`, and `skillRefs` are factory-supplied (every state
 * entry follows the same pattern).
 */
export interface ActionStateFactoryInput {
  /**
   * Enum member name (`'IDLE'`, `'TRIGGERED'`, ...).
   */
  readonly stateValue: DbxActionStateValue;
  /**
   * Underlying string literal value the enum member is assigned.
   */
  readonly literal: string;
  /**
   * Prose description of what the state is and when it occurs.
   */
  readonly description: string;
  /**
   * States that can transition INTO this state (incoming arrows).
   */
  readonly transitionsFrom: readonly DbxActionStateValue[];
  /**
   * States this state can transition OUT to (outgoing arrows).
   */
  readonly transitionsTo: readonly DbxActionStateValue[];
  /**
   * Override the default skill list.
   */
  readonly skillRefs?: readonly string[];
  /**
   * Override the default source path (`packages/dbx-core/src/lib/action/action.ts`).
   */
  readonly sourcePath?: string;
}

/**
 * Builds an {@link ActionStateInfo} entry. Defaults `role`, `enumName`,
 * `sourcePath`, and `skillRefs` — every state entry sits in the same
 * source file and references the same skill. Slug is derived as
 * `state-<lowercased-state-value>` since every state-entry slug follows
 * that pattern.
 *
 * @param input - per-entry fields
 * @returns the assembled state entry
 */
export function actionState(input: ActionStateFactoryInput): ActionStateInfo {
  return {
    role: 'state',
    slug: `state-${input.stateValue.toLowerCase().replace(/_/g, '-')}`,
    enumName: 'DbxActionState',
    stateValue: input.stateValue,
    literal: input.literal,
    description: input.description,
    skillRefs: input.skillRefs ?? DEFAULT_SKILL_REFS,
    sourcePath: input.sourcePath ?? STATE_SOURCE_PATH,
    transitionsFrom: input.transitionsFrom,
    transitionsTo: input.transitionsTo,
    example: `DbxActionState.${input.stateValue}`
  };
}
