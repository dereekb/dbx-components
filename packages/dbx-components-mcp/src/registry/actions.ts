/**
 * Action Registry.
 *
 * Canonical metadata for the @dereekb/dbx-core action surface — the directive
 * stack that wires a `dbxAction` context (root, value provider, trigger,
 * handler, feedback) plus the underlying state machine.
 *
 * Three entry shapes share a slug index but differ in payload:
 *
 *   - `directive` — Angular directive that contributes to a dbxAction context
 *     (e.g. `dbxAction`, `[dbxActionHandler]`, `[dbxActionAutoTrigger]`).
 *   - `store`     — the canonical NgRx ComponentStore that drives the lifecycle
 *     (`ActionContextStore`).
 *   - `state`     — a single member of the `DbxActionState` enum, with explicit
 *     transition arrows derived from the store's updaters.
 *
 * Slugs are kebab-case and unique across all three roles. Selectors and class
 * names mirror what is exported from `@dereekb/dbx-core` exactly — no fabricated
 * entries.
 */

// MARK: Common shapes
/**
 * Discriminator for the action registry's three entry shapes.
 */
export type ActionEntryRole = 'directive' | 'store' | 'state';

interface ActionEntryBase {
  /**
   * Unique registry slug (kebab-case).
   */
  readonly slug: string;
  /**
   * Discriminator.
   */
  readonly role: ActionEntryRole;
  /**
   * Prose description of what the entry is and when to reach for it.
   */
  readonly description: string;
  /**
   * Skill slugs callers can load for further context.
   */
  readonly skillRefs: readonly string[];
  /**
   * Path within the source repository where the entry is defined.
   */
  readonly sourcePath: string;
  /**
   * Copy-paste-ready usage snippet (HTML for directives, TS for store/state).
   */
  readonly example: string;
}

/**
 * Input on a directive — captures the alias, the underlying TypeScript type,
 * whether it is required, and a short description.
 */
export interface ActionInputInfo {
  /**
   * Template alias (the value passed in `[alias]="..."`).
   */
  readonly alias: string;
  /**
   * Class-side property name on the directive.
   */
  readonly propertyName: string;
  /**
   * TypeScript type displayed for the input.
   */
  readonly type: string;
  /**
   * Whether the input is required (`input.required`).
   */
  readonly required: boolean;
  /**
   * Optional default value, when one is configured.
   */
  readonly defaultValue?: string;
  /**
   * Short prose description.
   */
  readonly description: string;
}

/**
 * Output / event emitted by a directive (no current dbx-core action directive
 * exposes outputs, but the shape is reserved so `formatActionEntry` can grow
 * without churning the type).
 */
export interface ActionOutputInfo {
  readonly name: string;
  readonly type: string;
  readonly description: string;
}

/**
 * Directive entry. Captures selector + class + DI behavior + the action states
 * the directive interacts with.
 */
export interface ActionDirectiveInfo extends ActionEntryBase {
  readonly role: 'directive';
  /**
   * Full Angular `@Directive` selector string (e.g. `'[dbxActionHandler]'`).
   */
  readonly selector: string;
  /**
   * Exported class name (e.g. `'DbxActionHandlerDirective'`).
   */
  readonly className: string;
  /**
   * Module the directive is exported from.
   */
  readonly module: string;
  /**
   * Inputs the directive accepts.
   */
  readonly inputs: readonly ActionInputInfo[];
  /**
   * Outputs the directive emits.
   */
  readonly outputs: readonly ActionOutputInfo[];
  /**
   * Whether the directive `provide:`s a store (creates a context).
   */
  readonly producesContext: boolean;
  /**
   * Whether the directive `inject:`s a store (consumes a context).
   */
  readonly consumesContext: boolean;
  /**
   * Action states the directive reads and/or writes.
   */
  readonly stateInteraction: readonly DbxActionStateValue[];
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
 * Store entry — there is exactly one in the action registry today
 * (`ActionContextStore`), but the shape is reserved as a discriminated arm so
 * derivative stores (debug, mock) can join later without churning the type.
 */
export interface ActionStoreInfo extends ActionEntryBase {
  readonly role: 'store';
  /**
   * Exported class name.
   */
  readonly className: string;
  /**
   * Module the store is exported from.
   */
  readonly module: string;
  /**
   * Public methods on the store (updaters + utilities).
   */
  readonly methods: readonly ActionMethodInfo[];
  /**
   * Public observables on the store.
   */
  readonly observables: readonly ActionObservableInfo[];
  /**
   * Common disabled-key constants surfaced by sibling directives.
   */
  readonly disabledKeyDefaults: readonly string[];
}

/**
 * The literal string union of `DbxActionState` members. Mirrored from
 * `@dereekb/dbx-core`'s enum so the registry can reference states without
 * importing the enum directly.
 */
export type DbxActionStateValue = 'IDLE' | 'DISABLED' | 'TRIGGERED' | 'VALUE_READY' | 'WORKING' | 'REJECTED' | 'RESOLVED';

/**
 * State entry — one per member of the `DbxActionState` enum. Carries the
 * transition arrows so callers can render a state diagram.
 */
export interface ActionStateInfo extends ActionEntryBase {
  readonly role: 'state';
  /**
   * Always `'DbxActionState'`.
   */
  readonly enumName: 'DbxActionState';
  /**
   * Enum member name (`'IDLE'`, `'TRIGGERED'`, ...).
   */
  readonly stateValue: DbxActionStateValue;
  /**
   * Underlying string literal value the enum member is assigned.
   */
  readonly literal: string;
  /**
   * States that can transition INTO this state (incoming arrows).
   */
  readonly transitionsFrom: readonly DbxActionStateValue[];
  /**
   * States this state can transition OUT to (outgoing arrows).
   */
  readonly transitionsTo: readonly DbxActionStateValue[];
}

export type ActionEntryInfo = ActionDirectiveInfo | ActionStoreInfo | ActionStateInfo;

/**
 * Presentation order for roles in listings.
 */
export const ACTION_ROLE_ORDER: readonly ActionEntryRole[] = ['directive', 'store', 'state'];

const DBX_CORE_MODULE = '@dereekb/dbx-core';

// MARK: Registry entries
const DIRECTIVE_ENTRIES: readonly ActionDirectiveInfo[] = [
  {
    slug: 'action',
    role: 'directive',
    selector: 'dbx-action,[dbxAction]',
    className: 'DbxActionDirective',
    module: DBX_CORE_MODULE,
    description: 'Root of the action context. Creates an `ActionContextStore` and exposes it (plus source tokens) via DI so child action directives can read/write the same lifecycle. Reuses an upstream `SecondaryActionContextStoreSource` if one is provided on the host.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/directive/context/action.directive.ts',
    inputs: [],
    outputs: [],
    producesContext: true,
    consumesContext: false,
    stateInteraction: ['IDLE'],
    example: '<div dbxAction [dbxActionHandler]="handleSave">\n  <!-- value provider + trigger + feedback children -->\n</div>'
  },
  {
    slug: 'source',
    role: 'directive',
    selector: '[dbxActionSource]',
    className: 'DbxActionSourceDirective',
    module: DBX_CORE_MODULE,
    description: 'Forwards an externally created `ActionContextStoreSource` (e.g. one built programmatically by `DbxActionContextMachine`) as a `SecondaryActionContextStoreSource`, allowing a downstream `dbxAction` to reuse it instead of spinning up its own store.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/directive/context/action.source.directive.ts',
    inputs: [
      {
        alias: 'dbxActionSource',
        propertyName: 'dbxActionSource',
        type: 'Maybe<ActionContextStoreSource>',
        required: false,
        description: 'External source whose `store$` will be forwarded to children.'
      }
    ],
    outputs: [],
    producesContext: false,
    consumesContext: false,
    stateInteraction: [],
    example: '<div [dbxActionSource]="machineSource">\n  <div dbxAction>\n    <button (click)="action.trigger()">Submit</button>\n  </div>\n</div>'
  },
  {
    slug: 'handler',
    role: 'directive',
    selector: '[dbxActionHandler]',
    className: 'DbxActionHandlerDirective',
    module: DBX_CORE_MODULE,
    description: 'Wires a `Work<T, O>` (or `WorkUsingContext<T, O>`) function as the action handler. Runs when the store transitions to VALUE_READY and is responsible for moving it through WORKING → RESOLVED/REJECTED via the work context.',
    skillRefs: ['dbx__ref__dbx-component-patterns', 'dbx__guide__action-analytics'],
    sourcePath: 'packages/dbx-core/src/lib/action/directive/state/action.handler.directive.ts',
    inputs: [
      {
        alias: 'dbxActionHandler',
        propertyName: 'handlerFunction',
        type: 'Maybe<Work<T, O>>',
        required: true,
        description: 'The work function invoked when a value is ready. Required.'
      }
    ],
    outputs: [],
    producesContext: false,
    consumesContext: true,
    stateInteraction: ['VALUE_READY', 'WORKING', 'RESOLVED', 'REJECTED'],
    example: '<div dbxAction [dbxActionHandler]="handleSave">\n  <!-- value provider + trigger -->\n</div>'
  },
  {
    slug: 'handler-value',
    role: 'directive',
    selector: '[dbxActionHandlerValue]',
    className: 'DbxActionHandlerValueDirective',
    module: DBX_CORE_MODULE,
    description: 'Lighter-weight alternative to `[dbxActionHandler]`: accepts a static value, getter, or factory and uses the resolved value as the action result directly. Lifecycle (working → success) is handled internally.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/directive/state/action.handler.directive.ts',
    inputs: [
      {
        alias: 'dbxActionHandlerValue',
        propertyName: 'handlerValue',
        type: 'Maybe<GetterOrValue<O> | FactoryWithInput<O, T>>',
        required: true,
        description: 'Value, getter, or factory used as the action result.'
      }
    ],
    outputs: [],
    producesContext: false,
    consumesContext: true,
    stateInteraction: ['VALUE_READY', 'WORKING', 'RESOLVED'],
    example: '<div dbxAction [dbxActionHandlerValue]="computeSummary">\n  <button dbxActionButton>Compute</button>\n</div>'
  },
  {
    slug: 'value',
    role: 'directive',
    selector: 'dbxActionValue,[dbxActionValue]',
    className: 'DbxActionValueDirective',
    module: DBX_CORE_MODULE,
    description: 'Always-available value provider. Whenever the action is TRIGGERED, the resolved value (a static value or the result of a getter) is fed into `readyValue()`. Use when the action does not have a form. Filters out null/undefined — for nullable values use `[dbxActionValueGetter]`.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/directive/state/action.value.directive.ts',
    inputs: [
      {
        alias: 'dbxActionValue',
        propertyName: 'valueOrFunction',
        type: "Maybe<GetterOrValue<T> | ''>",
        required: false,
        description: 'Static value or getter function. An empty string is allowed (no value).'
      }
    ],
    outputs: [],
    producesContext: false,
    consumesContext: true,
    stateInteraction: ['TRIGGERED', 'VALUE_READY'],
    example: '<ng-container dbxAction dbxActionValue [dbxActionHandler]="handleClear">\n  <dbx-button dbxActionButton text="Clear"></dbx-button>\n</ng-container>'
  },
  {
    slug: 'value-getter',
    role: 'directive',
    selector: '[dbxActionValueGetter]',
    className: 'DbxActionValueTriggerDirective',
    module: DBX_CORE_MODULE,
    description: 'Lazy value provider that calls a getter only when the action is TRIGGERED. Supports optional `isModified` and `isEqual` functions to short-circuit `readyValue` when the value has not changed.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/directive/state/action.value.trigger.directive.ts',
    inputs: [
      {
        alias: 'dbxActionValueGetter',
        propertyName: 'dbxActionValueGetter',
        type: 'Maybe<DbxActionValueGetterValueGetterFunction<T>>',
        required: false,
        description: 'Getter function invoked when the action triggers.'
      },
      {
        alias: 'dbxActionValueGetterIsModified',
        propertyName: 'dbxActionValueGetterIsModified',
        type: 'Maybe<IsModifiedFunction>',
        required: false,
        description: 'Predicate consulted before `readyValue()` is called.'
      },
      {
        alias: 'dbxActionValueGetterIsEqual',
        propertyName: 'dbxActionValueGetterIsEqual',
        type: 'Maybe<IsEqualFunction>',
        required: false,
        description: 'Equality predicate used to suppress duplicate values.'
      }
    ],
    outputs: [],
    producesContext: false,
    consumesContext: true,
    stateInteraction: ['TRIGGERED', 'VALUE_READY'],
    example: '<ng-container dbxAction [dbxActionValueGetter]="getFormSnapshot" [dbxActionHandler]="handleSubmit"></ng-container>'
  },
  {
    slug: 'auto-trigger',
    role: 'directive',
    selector: 'dbxActionAutoTrigger,[dbxActionAutoTrigger]',
    className: 'DbxActionAutoTriggerDirective',
    module: DBX_CORE_MODULE,
    description: 'Auto-fires the action whenever it becomes "modified and can trigger". Configurable debounce, throttle, error-aware throttle (slows down as consecutive errors mount), and an optional trigger limit.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/directive/auto/action.autotrigger.directive.ts',
    inputs: [
      { alias: 'dbxActionAutoTrigger', propertyName: 'triggerEnabled', type: 'boolean', required: false, defaultValue: 'true', description: 'Enable/disable the auto-trigger behavior.' },
      { alias: 'triggerDebounce', propertyName: 'triggerDebounce', type: 'Maybe<number>', required: false, defaultValue: '2000', description: 'Debounce in ms before firing after a modification.' },
      { alias: 'triggerThrottle', propertyName: 'triggerThrottle', type: 'Maybe<number>', required: false, defaultValue: '10000', description: 'Throttle in ms between consecutive auto-triggers.' },
      { alias: 'triggerErrorThrottle', propertyName: 'triggerErrorThrottle', type: 'number', required: false, defaultValue: '3000', description: 'Per-error throttle increment in ms.' },
      { alias: 'triggerLimit', propertyName: 'triggerLimit', type: 'Maybe<number>', required: false, description: 'Maximum number of auto-triggers in this lifetime.' },
      { alias: 'useFastTriggerPreset', propertyName: 'useFastTriggerPreset', type: 'boolean', required: false, description: 'Preset using a 200ms debounce/throttle.' },
      { alias: 'useInstantTriggerPreset', propertyName: 'useInstantTriggerPreset', type: 'boolean', required: false, description: 'Preset using a ~10ms debounce/throttle.' }
    ],
    outputs: [],
    producesContext: false,
    consumesContext: true,
    stateInteraction: ['IDLE', 'TRIGGERED'],
    example: '<div dbxAction>\n  <ng-container dbxActionAutoTrigger useFastTriggerPreset></ng-container>\n  <my-form dbxActionForm [dbxFormSource]="data$"></my-form>\n</div>'
  },
  {
    slug: 'auto-modify',
    role: 'directive',
    selector: 'dbxActionAutoModify, [dbxActionAutoModify]',
    className: 'DbxActionAutoModifyDirective',
    module: DBX_CORE_MODULE,
    description: 'Continuously remarks the action as modified whenever it falls back to unmodified, keeping it eligible to trigger. Combine with `[dbxActionAutoTrigger]` and `[dbxActionEnforceModified]` for always-on submission flows.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/directive/auto/action.automodify.directive.ts',
    inputs: [
      {
        alias: 'dbxActionAutoModify',
        propertyName: 'autoModifyEnabled',
        type: 'boolean',
        required: false,
        defaultValue: 'true',
        description: 'Enable/disable auto-modify (set to false to opt out).'
      }
    ],
    outputs: [],
    producesContext: false,
    consumesContext: true,
    stateInteraction: ['IDLE'],
    example: '<div dbxAction>\n  <ng-container dbxActionAutoModify></ng-container>\n  <ng-container dbxActionAutoTrigger></ng-container>\n</div>'
  },
  {
    slug: 'disabled',
    role: 'directive',
    selector: '[dbxActionDisabled]',
    className: 'DbxActionDisabledDirective',
    module: DBX_CORE_MODULE,
    description: 'Disables the action under the `dbx_action_disabled` key while the bound expression is truthy. Disable keys are additive — multiple sources can independently disable the action.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/directive/state/action.disabled.directive.ts',
    inputs: [
      {
        alias: 'dbxActionDisabled',
        propertyName: 'disabled',
        type: "boolean | ''",
        required: false,
        defaultValue: 'false',
        description: 'When truthy, disables the action; when falsy, removes the disable key.'
      }
    ],
    outputs: [],
    producesContext: false,
    consumesContext: true,
    stateInteraction: ['DISABLED'],
    example: '<div dbxAction [dbxActionDisabled]="form.invalid">\n  <button dbxActionButton>Submit</button>\n</div>'
  },
  {
    slug: 'enforce-modified',
    role: 'directive',
    selector: '[dbxActionEnforceModified]',
    className: 'DbxActionEnforceModifiedDirective',
    module: DBX_CORE_MODULE,
    description: 'Disables the action under the `dbx_action_enforce_modified` key whenever it is not flagged modified. Prevents no-op submissions on forms that have not changed.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/directive/state/action.enforce.modified.directive.ts',
    inputs: [
      {
        alias: 'dbxActionEnforceModified',
        propertyName: 'enabled',
        type: "boolean | ''",
        required: false,
        defaultValue: 'true',
        description: 'Set to false to opt out of the enforce-modified gating.'
      }
    ],
    outputs: [],
    producesContext: false,
    consumesContext: true,
    stateInteraction: ['IDLE', 'DISABLED'],
    example: '<div dbxAction dbxActionEnforceModified [dbxActionHandler]="handleSave">\n  <my-form dbxActionForm [dbxFormSource]="data$"></my-form>\n</div>'
  },
  {
    slug: 'disabled-on-success',
    role: 'directive',
    selector: '[dbxActionDisabledOnSuccess]',
    className: 'DbxActionDisabledOnSuccessDirective',
    module: DBX_CORE_MODULE,
    description: 'Latches the action into a DISABLED state once it RESOLVES — useful for one-shot forms (e.g. checkout) where re-submission is not allowed.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/directive/state/action.disableonsuccess.directive.ts',
    inputs: [
      {
        alias: 'dbxActionDisabledOnSuccess',
        propertyName: 'enabled',
        type: "boolean | ''",
        required: false,
        defaultValue: 'true',
        description: 'Set to false to opt out of the disable-on-success behavior.'
      }
    ],
    outputs: [],
    producesContext: false,
    consumesContext: true,
    stateInteraction: ['RESOLVED', 'DISABLED'],
    example: '<div dbxAction dbxActionDisabledOnSuccess [dbxActionHandler]="placeOrder">\n  <button dbxActionButton>Place order</button>\n</div>'
  },
  {
    slug: 'error-handler',
    role: 'directive',
    selector: '[dbxActionErrorHandler]',
    className: 'DbxActionErrorHandlerDirective',
    module: DBX_CORE_MODULE,
    description: 'Side-effect callback invoked whenever the action emits a new error. Useful for logging, analytics, or surfacing custom toasts on REJECTED.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/directive/state/action.error.handler.directive.ts',
    inputs: [
      {
        alias: 'dbxActionErrorHandler',
        propertyName: 'dbxActionErrorHandler',
        type: 'Maybe<DbxActionErrorHandlerFunction>',
        required: false,
        description: 'Callback receiving the latest `ReadableError`.'
      }
    ],
    outputs: [],
    producesContext: false,
    consumesContext: true,
    stateInteraction: ['REJECTED'],
    example: '<div dbxAction [dbxActionErrorHandler]="onError" [dbxActionHandler]="handleSave">\n  <!-- ... -->\n</div>'
  },
  {
    slug: 'context-map',
    role: 'directive',
    selector: '[dbxActionContextMap]',
    className: 'DbxActionContextMapDirective',
    module: DBX_CORE_MODULE,
    description: 'Provides an `ActionContextStoreSourceMap` so sibling actions registered with `[dbxActionMapSource]` can be looked up by key with `[dbxActionFromMap]`. Enables cross-action coordination (e.g. disabling siblings while one is working).',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/directive/map/action.map.directive.ts',
    inputs: [],
    outputs: [],
    producesContext: false,
    consumesContext: false,
    stateInteraction: [],
    example: '<div dbxActionContextMap>\n  <div dbxAction [dbxActionMapSource]="\'save\'">...</div>\n  <div [dbxActionFromMap]="\'save\'">consumer</div>\n</div>'
  },
  {
    slug: 'logger',
    role: 'directive',
    selector: '[dbxActionLogger],[dbxActionContextLogger]',
    className: 'DbxActionContextLoggerDirective',
    module: DBX_CORE_MODULE,
    description: 'Diagnostic directive — logs every state transition of the parent action context to the console. Drop in temporarily while debugging an action that is not firing as expected.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/directive/debug/action.logger.directive.ts',
    inputs: [],
    outputs: [],
    producesContext: false,
    consumesContext: true,
    stateInteraction: ['IDLE', 'TRIGGERED', 'VALUE_READY', 'WORKING', 'RESOLVED', 'REJECTED', 'DISABLED'],
    example: '<div dbxAction dbxActionLogger [dbxActionHandler]="handleSave">\n  <!-- transitions print to console -->\n</div>'
  }
];

const STORE_ENTRIES: readonly ActionStoreInfo[] = [
  {
    slug: 'action-context-store',
    role: 'store',
    className: 'ActionContextStore',
    module: DBX_CORE_MODULE,
    description: 'NgRx ComponentStore that drives a single action lifecycle. Owns the `DbxActionState` machine, tracks modification, captures input value + output result + error, and coordinates teardown through a `LockSet` so in-flight work finishes before the store is destroyed. Directives interact with it through the `DbxActionContextStoreSourceInstance` convenience wrapper rather than injecting the raw store.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/action.store.ts',
    methods: [
      { name: 'trigger', signature: 'trigger(): void', description: 'Transitions IDLE → TRIGGERED if not disabled. Clears any previous value but preserves the last error.' },
      { name: 'readyValue', signature: 'readyValue(value: T): void', description: 'TRIGGERED → VALUE_READY. Stores the input value and clears any previous result.' },
      { name: 'startWorking', signature: 'startWorking(): void', description: 'VALUE_READY → WORKING. Resets the work-progress slot.' },
      { name: 'setWorkProgress', signature: 'setWorkProgress(progress: Maybe<DbxActionWorkProgress>): void', description: 'Updates the in-flight progress indicator while WORKING.' },
      { name: 'resolve', signature: 'resolve(result?: Maybe<O>): void', description: 'WORKING → RESOLVED. Clears modified flag and any prior error.' },
      { name: 'reject', signature: 'reject(error?: Maybe<ReadableError>): void', description: 'WORKING → REJECTED. Bumps `errorCount` and clears the staged value.' },
      { name: 'reset', signature: 'reset(): void', description: 'Clears the entire state back to the initial IDLE/unmodified snapshot.' },
      { name: 'setIsModified', signature: 'setIsModified(isModified?: boolean): void', description: 'Marks the action as modified (default) or unmodified. From RESOLVED, transitions to IDLE.' },
      { name: 'setIsSame', signature: 'setIsSame(isSame?: boolean): void', description: 'Inverse of `setIsModified` — convenience for form-equality wires.' },
      { name: 'disable', signature: 'disable(key?: DbxActionDisabledKey): void', description: 'Adds a disabled-key entry; while ANY key is set the action is treated as DISABLED.' },
      { name: 'enable', signature: 'enable(key?: DbxActionDisabledKey): void', description: 'Removes a disabled-key entry. Removing the last one re-enables the action.' }
    ],
    observables: [
      { name: 'actionState$', type: 'Observable<DbxActionState>', description: 'Current state, with DISABLED collapsing in when any disable key is active and the action is idle.' },
      { name: 'idle$', type: 'Observable<boolean>', description: 'True when the action is in IDLE.' },
      { name: 'triggered$', type: 'Observable<true>', description: 'Emits when the state becomes TRIGGERED.' },
      { name: 'valueReady$', type: 'Observable<T>', description: 'Emits the staged input value on VALUE_READY.' },
      { name: 'working$', type: 'Observable<true>', description: 'Emits when the state becomes WORKING.' },
      { name: 'isWorking$', type: 'Observable<boolean>', description: 'True for any in-progress (non-idle) state.' },
      { name: 'workProgress$', type: 'Observable<Maybe<DbxActionWorkProgress>>', description: 'Latest progress indicator while WORKING.' },
      { name: 'success$', type: 'Observable<Maybe<O>>', description: 'Emits the result on RESOLVED.' },
      { name: 'successPair$', type: 'Observable<DbxActionSuccessPair<T, O>>', description: 'Emits `{ value, result }` on RESOLVED.' },
      { name: 'rejected$', type: 'Observable<Maybe<ReadableError>>', description: 'Emits the error on REJECTED.' },
      { name: 'rejectedPair$', type: 'Observable<DbxActionRejectedPair<T>>', description: 'Emits `{ value, error }` on REJECTED.' },
      { name: 'isModified$', type: 'Observable<boolean>', description: 'Distinct boolean of the modification flag.' },
      { name: 'isModifiedAndCanTrigger$', type: 'Observable<boolean>', description: 'True when modified and the state allows triggering.' },
      { name: 'canTrigger$', type: 'Observable<boolean>', description: 'True when the current state allows `trigger()` to fire.' },
      { name: 'disabledKeys$', type: 'Observable<string[]>', description: 'Array of currently active disable keys.' },
      { name: 'isDisabled$', type: 'Observable<boolean>', description: 'True whenever the action is effectively disabled.' },
      { name: 'errorCountSinceLastSuccess$', type: 'Observable<number>', description: 'Counter that resets on each RESOLVED.' },
      { name: 'loadingState$', type: 'Observable<LoadingState<O>>', description: 'Convenience adapter exposing the lifecycle as a `LoadingState`.' }
    ],
    disabledKeyDefaults: ['dbx_action_disabled', 'dbx_action_enforce_modified'],
    example: "// Most directives inject `DbxActionContextStoreSourceInstance` and call helpers on it.\n// Direct store access:\nconst store = inject(ActionContextStore<MyValue, MyResult>);\nstore.disable('my_key');"
  }
];

const STATE_ENTRIES: readonly ActionStateInfo[] = [
  {
    slug: 'state-idle',
    role: 'state',
    enumName: 'DbxActionState',
    stateValue: 'IDLE',
    literal: 'idle',
    description: 'Default state — no work in progress, ready to be triggered. Set on construction and after `reset()` or `setIsModified()` from RESOLVED.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/action.ts',
    transitionsFrom: ['RESOLVED', 'REJECTED', 'DISABLED'],
    transitionsTo: ['TRIGGERED', 'DISABLED'],
    example: 'DbxActionState.IDLE'
  },
  {
    slug: 'state-disabled',
    role: 'state',
    enumName: 'DbxActionState',
    stateValue: 'DISABLED',
    literal: 'disabled',
    description: 'Idle and gated — at least one disable key is set. The store still reports its underlying actionState in state objects but `actionState$` collapses to DISABLED so consumers gate UI.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/action.ts',
    transitionsFrom: ['IDLE', 'RESOLVED', 'REJECTED'],
    transitionsTo: ['IDLE'],
    example: 'DbxActionState.DISABLED'
  },
  {
    slug: 'state-triggered',
    role: 'state',
    enumName: 'DbxActionState',
    stateValue: 'TRIGGERED',
    literal: 'triggered',
    description: 'A trigger fired. The store waits for a value provider to call `readyValue()`. Without a value provider the action stalls here forever.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/action.ts',
    transitionsFrom: ['IDLE'],
    transitionsTo: ['VALUE_READY'],
    example: 'DbxActionState.TRIGGERED'
  },
  {
    slug: 'state-value-ready',
    role: 'state',
    enumName: 'DbxActionState',
    stateValue: 'VALUE_READY',
    literal: 'valueReady',
    description: 'A value has been staged for the action. The handler directive picks it up immediately and transitions to WORKING.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/action.ts',
    transitionsFrom: ['TRIGGERED'],
    transitionsTo: ['WORKING'],
    example: 'DbxActionState.VALUE_READY'
  },
  {
    slug: 'state-working',
    role: 'state',
    enumName: 'DbxActionState',
    stateValue: 'WORKING',
    literal: 'working',
    description: 'Handler is in flight. Buttons disable, snackbars show "Working...", `workProgress` may stream updates.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/action.ts',
    transitionsFrom: ['VALUE_READY'],
    transitionsTo: ['RESOLVED', 'REJECTED'],
    example: 'DbxActionState.WORKING'
  },
  {
    slug: 'state-resolved',
    role: 'state',
    enumName: 'DbxActionState',
    stateValue: 'RESOLVED',
    literal: 'resolved',
    description: 'The handler succeeded. Result is stored, modified flag is cleared, error is cleared. From here `setIsModified()` returns the action to IDLE.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/action.ts',
    transitionsFrom: ['WORKING'],
    transitionsTo: ['IDLE', 'DISABLED'],
    example: 'DbxActionState.RESOLVED'
  },
  {
    slug: 'state-rejected',
    role: 'state',
    enumName: 'DbxActionState',
    stateValue: 'REJECTED',
    literal: 'rejected',
    description: 'The handler failed. `errorCount` increments and the error is exposed for handlers/snackbars. The action returns to IDLE on the next trigger or `setIsModified()`.',
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    sourcePath: 'packages/dbx-core/src/lib/action/action.ts',
    transitionsFrom: ['WORKING'],
    transitionsTo: ['IDLE', 'DISABLED'],
    example: 'DbxActionState.REJECTED'
  }
];

/**
 * Every entry in the action registry, ordered directives → store → states.
 */
export const ACTION_ENTRIES: readonly ActionEntryInfo[] = [...DIRECTIVE_ENTRIES, ...STORE_ENTRIES, ...STATE_ENTRIES];

/**
 * Every distinct `DbxActionState` member referenced by the registry.
 * Useful for asserting that directive entries only cite real states.
 */
export const ACTION_STATE_VALUES: readonly DbxActionStateValue[] = STATE_ENTRIES.map((s) => s.stateValue);
