import { type Type } from '@angular/core';
import { type Observable } from 'rxjs';
import { type Work } from '@dereekb/rxjs';
import { type ArrayOrValue, type DestroyFunction, type ErrorInput, type JsonCompatible, type Maybe, type ModelIdFactory, type ReadableError, sequentialIncrementingNumberStringModelIdFactory, toReadableError } from '@dereekb/util';
import { type DbxButtonStyle } from '@dereekb/dbx-web';

// MARK: Keys
/**
 * Unique key of a section within a flow.
 */
export type DbxLlmFlowSectionKey = string;

/**
 * Unique id of a run within a flow.
 */
export type DbxLlmFlowRunId = string;

/**
 * The kind of run. A section can have several run kinds (e.g. "plan" and "render"), each with its own button and action.
 */
export type DbxLlmFlowRunKind = string;

/**
 * Id of a bound form instance. Each live form instance (inline, dialog, detached window) registers its own binding.
 */
export type DbxLlmFlowFormBindingId = number;

/**
 * Id of a run request.
 */
export type DbxLlmFlowRunRequestId = number;

/**
 * State of a run.
 */
export type DbxLlmFlowRunState = 'running' | 'success' | 'failed';

/**
 * Where a section's raw input comes from.
 *
 * - form: generated from the form value.
 * - parent: generated from the output of the followed parent run.
 * - manual: typed or pasted. Overrides the form, or the parent's output, when the section has one.
 * - none: nothing yet. A section without a form is waiting on its parent's first run.
 */
export type DbxLlmFlowSectionInputSource = 'form' | 'parent' | 'manual' | 'none';

// MARK: Constants
export const DEFAULT_DBX_LLM_FLOW_RUN_KIND: DbxLlmFlowRunKind = 'run';

/**
 * Disabled key the run bridge sets on its action while the section can't run.
 */
export const DBX_LLM_FLOW_SECTION_RUN_DISABLED_KEY = 'dbx_llm_flow_section_run';

/**
 * Disabled key the form binding sets on its form while the section's form is locked.
 */
export const DBX_LLM_FLOW_SECTION_FORM_DISABLED_KEY = 'dbx_llm_flow_section_form';

/**
 * Error code of a run that was still running when the flow was restored or switched storage keys.
 */
export const DBX_LLM_FLOW_RUN_INTERRUPTED_ERROR_CODE = 'DBX_LLM_FLOW_RUN_INTERRUPTED';

/**
 * Error code of a run that was cancelled through cancelRun().
 */
export const DBX_LLM_FLOW_RUN_CANCELLED_ERROR_CODE = 'DBX_LLM_FLOW_RUN_CANCELLED';

/**
 * Error code thrown by the run bridge when the section is blocked at trigger time.
 */
export const DBX_LLM_FLOW_RUN_BLOCKED_ERROR_CODE = 'DBX_LLM_FLOW_RUN_BLOCKED';

/**
 * Error code of a run whose output is not JSON-compatible.
 */
export const DBX_LLM_FLOW_RUN_NON_JSON_OUTPUT_ERROR_CODE = 'DBX_LLM_FLOW_RUN_NON_JSON_OUTPUT';

/**
 * Prefix of the storage keys a persisted flow writes to.
 */
export const DBX_LLM_FLOW_STORAGE_PREFIX = 'dbx_llm_flow';

export const DEFAULT_DBX_LLM_FLOW_MAX_PERSISTED_RUNS_PER_SECTION = 25;

// MARK: State
/**
 * The input of a section. The form value must be JSON-compatible.
 */
export interface DbxLlmFlowSectionInput<F = unknown> {
  readonly formValue?: Maybe<F>;
  /**
   * The raw input text. Generated from the form value unless it is overridden.
   */
  readonly rawInput: string;
  /**
   * Whether the raw input was pasted/typed over the generated input: the form value, or the parent's output for a section without a form.
   * While overridden, form pushes are ignored and the form is locked.
   */
  readonly rawInputOverridden?: Maybe<boolean>;
}

export interface DbxLlmFlowRunError {
  readonly code?: Maybe<string>;
  readonly message?: Maybe<string>;
}

/**
 * A single run of a section. Outputs must be JSON-compatible.
 */
export interface DbxLlmFlowRun<F = unknown, O = unknown> {
  readonly id: DbxLlmFlowRunId;
  readonly sectionKey: DbxLlmFlowSectionKey;
  readonly kind: DbxLlmFlowRunKind;
  /**
   * The parent section's run that the section followed when this run started.
   */
  readonly parentRunId?: Maybe<DbxLlmFlowRunId>;
  readonly input: DbxLlmFlowSectionInput<F>;
  readonly state: DbxLlmFlowRunState;
  readonly output?: Maybe<O>;
  readonly error?: Maybe<DbxLlmFlowRunError>;
  readonly startedAt: Date;
  readonly finishedAt?: Maybe<Date>;
  /**
   * Whether the run was imported with importRuns().
   */
  readonly imported?: Maybe<boolean>;
  /**
   * Arbitrary JSON metadata from the app (server key, tokens, cost, etc.)
   */
  readonly data?: Maybe<JsonCompatible<unknown>>;
}

export interface DbxLlmFlowSectionState<F = unknown> {
  readonly key: DbxLlmFlowSectionKey;
  readonly parentKey?: Maybe<DbxLlmFlowSectionKey>;
  /**
   * The current input. Persisted.
   */
  readonly draft: DbxLlmFlowSectionInput<F>;
  /**
   * The selected runs, at most one per kind. The last is the primary selection. Persisted.
   */
  readonly selectedRunIds: readonly DbxLlmFlowRunId[];
  /**
   * The parent run this section derives from. Persisted.
   */
  readonly followedParentRunId?: Maybe<DbxLlmFlowRunId>;
  readonly lastFailedRunId?: Maybe<DbxLlmFlowRunId>;
  /**
   * Message of the last raw input parse failure.
   */
  readonly rawInputParseError?: Maybe<string>;
  /**
   * Message of the last rejected (non-JSON) form value.
   */
  readonly formValueError?: Maybe<string>;
  /**
   * Every issue that blocks a run: empty input, parse failures, non-JSON values and validateInput() messages.
   */
  readonly inputIssues?: Maybe<readonly string[]>;
  /**
   * Runtime. Bumps on every draft change.
   */
  readonly draftRevision: number;
  /**
   * Runtime. The binding that made the last draft change. Undefined when the change originated from the store.
   */
  readonly draftSource?: Maybe<DbxLlmFlowFormBindingId>;
  /**
   * Runtime. The run currently running for this section.
   */
  readonly activeRunId?: Maybe<DbxLlmFlowRunId>;
  /**
   * Runtime. Whether the bound form is valid. Unknown is treated as valid.
   */
  readonly formValid?: Maybe<boolean>;
  /**
   * Runtime. Number of mounted section directives.
   */
  readonly mountCount: number;
  /**
   * Runtime. Number of mounted run bridges per kind.
   */
  readonly runBridgeCounts?: Maybe<Readonly<Record<DbxLlmFlowRunKind, number>>>;
}

/**
 * A request for a section's run bridge to trigger its action.
 */
export interface DbxLlmFlowRunRequest {
  readonly id: DbxLlmFlowRunRequestId;
  readonly kind: DbxLlmFlowRunKind;
  /**
   * The draft revision the request was made for. The request goes stale when the draft changes.
   */
  readonly draftRevision: number;
}

export interface DbxLlmFlowState {
  readonly sections: Readonly<Record<DbxLlmFlowSectionKey, DbxLlmFlowSectionState>>;
  readonly runs: Readonly<Record<DbxLlmFlowRunId, DbxLlmFlowRun>>;
  readonly runRequests: Readonly<Record<DbxLlmFlowSectionKey, DbxLlmFlowRunRequest>>;
  readonly restoring: boolean;
  readonly storageKey?: Maybe<string>;
}

/**
 * The value an app's run handler receives.
 */
export interface DbxLlmFlowRunValue<F = unknown, O = unknown> {
  readonly runId: DbxLlmFlowRunId;
  readonly sectionKey: DbxLlmFlowSectionKey;
  readonly kind: DbxLlmFlowRunKind;
  readonly input: DbxLlmFlowSectionInput<F>;
  readonly parentRun?: Maybe<DbxLlmFlowRun<unknown, unknown>>;
  /**
   * The parent run's lineage, root first, ending with the parent run.
   */
  readonly lineage: readonly DbxLlmFlowRun[];
  /**
   * Type marker for the output. Never set.
   */
  readonly outputType?: Maybe<O>;
}

/**
 * Reason a section can't run right now, in gating order.
 */
export type DbxLlmFlowRunBlockedReason = 'unknown_section' | 'restoring' | 'running' | 'exclusive_running' | 'ancestor_running' | 'parent_run_required' | 'invalid_input' | 'invalid_form';

export interface DbxLlmFlowRunAvailability {
  readonly canRun: boolean;
  readonly blockedReason?: Maybe<DbxLlmFlowRunBlockedReason>;
}

// MARK: Config
/**
 * A run kind of a section, and the run button that triggers it.
 */
export interface DbxLlmFlowSectionRunKindConfig<F = unknown, O = unknown> {
  readonly kind: DbxLlmFlowRunKind;
  /**
   * Text of the run button. Defaults to the kind.
   */
  readonly text?: Maybe<string>;
  /**
   * Icon of the run button. Defaults to no icon.
   */
  readonly icon?: Maybe<string>;
  /**
   * Style of the run button. Defaults to a raised primary button.
   */
  readonly buttonStyle?: Maybe<DbxButtonStyle>;
  /**
   * The handler that performs the run. The resolved value is recorded as the run's output.
   */
  readonly handler?: Maybe<Work<DbxLlmFlowRunValue<F, O>, O>>;
}

/**
 * How the raw input reacts to pastes and typing.
 *
 * - two-way: typing and pastes are parsed back into the form value. Text that fails to parse overrides the form, with a parse error, until it
 *   parses (the default for sections with a form).
 * - one-way: pastes override the raw input; the form is locked or hidden while overridden. The raw input can't be typed into.
 * - editable: the raw input can be typed into or pasted over, and overrides the form or the parent's output (the default for sections without
 *   a form).
 * - readonly: the raw input can't be changed.
 */
export type DbxLlmFlowRawInputMode = 'two-way' | 'one-way' | 'editable' | 'readonly';

/**
 * How a form behaves while its raw input is overridden.
 */
export type DbxLlmFlowRawInputOneWayFormMode = 'lock' | 'hide';

export interface DbxLlmFlowSectionRawInputConfig {
  readonly mode?: Maybe<DbxLlmFlowRawInputMode>;
  readonly oneWayFormMode?: Maybe<DbxLlmFlowRawInputOneWayFormMode>;
  readonly minRows?: Maybe<number>;
  readonly maxRows?: Maybe<number>;
  readonly label?: Maybe<string>;
  readonly hint?: Maybe<string>;
  /**
   * Whether to show where the raw input comes from (the form, the parent's output, or manual input) above the field. Defaults to true.
   */
  readonly showSource?: Maybe<boolean>;
}

export interface DbxLlmFlowFromParentOutputInput<F = unknown, P = unknown> {
  readonly parentRun: DbxLlmFlowRun<unknown, P>;
  readonly parentOutput: Maybe<P>;
  readonly draft: DbxLlmFlowSectionInput<F>;
}

/**
 * Pop-out configuration for a section's form.
 */
export interface DbxLlmFlowSectionFormPopoutConfig {
  readonly mode?: Maybe<DbxLlmFlowSectionFormPopoutMode>;
  /**
   * Whether to close the pop-out when a run starts.
   */
  readonly closeOnRun?: Maybe<boolean>;
}

export type DbxLlmFlowSectionFormPopoutMode = 'dialog' | 'detach';

/**
 * Which parts of a section are shown.
 */
export interface DbxLlmFlowSectionDisplayConfig {
  readonly header?: Maybe<boolean>;
  readonly form?: Maybe<boolean>;
  readonly rawInput?: Maybe<boolean>;
  /**
   * The run buttons, one per run kind. They sit to the right of the raw input and take its height, or below the form when the raw input is
   * hidden.
   */
  readonly runButtons?: Maybe<boolean>;
  readonly history?: Maybe<boolean>;
  readonly output?: Maybe<boolean>;
}

export interface DbxLlmFlowRunDescription {
  readonly title: string;
  readonly detail?: Maybe<string>;
}

export type DbxLlmFlowDescribeRunFunction = (run: DbxLlmFlowRun) => Maybe<DbxLlmFlowRunDescription>;

export interface DbxLlmFlowSectionConfig<F = unknown, O = unknown> {
  readonly key: DbxLlmFlowSectionKey;
  /**
   * The parent section. When unset, the nearest ancestor section directive is used.
   */
  readonly parentKey?: Maybe<DbxLlmFlowSectionKey>;
  readonly label?: Maybe<string>;
  readonly hint?: Maybe<string>;
  /**
   * Run kinds. Defaults to a single "Run" kind.
   */
  readonly kinds?: Maybe<readonly DbxLlmFlowSectionRunKindConfig<F, O>[]>;
  /**
   * The parent run kinds this section follows. Defaults to all kinds.
   */
  readonly followParentKinds?: Maybe<readonly DbxLlmFlowRunKind[]>;
  /**
   * Whether the section needs a parent run to run.
   */
  readonly requireParentRun?: Maybe<boolean>;
  /**
   * Whether a parent's successful run requests this section's run. True runs the first kind; a kind runs that kind.
   */
  readonly autoRunAfterParent?: Maybe<boolean | DbxLlmFlowRunKind>;
  readonly initialDraft?: Maybe<Partial<DbxLlmFlowSectionInput<F>>>;
  /**
   * Whether the section has a form. Defaults to whether formComponent is set.
   */
  readonly hasForm?: Maybe<boolean>;
  /**
   * Converts the form value to the raw input. Defaults to pretty JSON.
   */
  readonly toRawInput?: Maybe<(formValue: Maybe<F>) => string>;
  /**
   * Parses raw input back to a form value. Throws on failure. Defaults to JSON.parse() and a JSON check.
   */
  readonly fromRawInput?: Maybe<(rawInput: string) => F>;
  /**
   * Updates the draft from the parent's output. Returns undefined to keep the draft.
   *
   * Defaults to using a string output as the raw input of a section without a form.
   */
  readonly fromParentOutput?: Maybe<(input: DbxLlmFlowFromParentOutputInput<F>) => Maybe<Partial<DbxLlmFlowSectionInput<F>>>>;
  /**
   * Returns messages that block running.
   */
  readonly validateInput?: Maybe<(input: DbxLlmFlowSectionInput<F>) => Maybe<ArrayOrValue<string>>>;
  readonly allowEmptyInput?: Maybe<boolean>;
  readonly rawInput?: Maybe<DbxLlmFlowSectionRawInputConfig>;
  readonly formComponent?: Maybe<Type<unknown>>;
  /**
   * Whether to bind formComponent to the section automatically. Defaults to true.
   */
  readonly autoBindForm?: Maybe<boolean>;
  readonly formPopout?: Maybe<DbxLlmFlowSectionFormPopoutConfig | false>;
  readonly outputComponent?: Maybe<Type<unknown>>;
  readonly describeRun?: Maybe<DbxLlmFlowDescribeRunFunction>;
  readonly display?: Maybe<DbxLlmFlowSectionDisplayConfig>;
}

/**
 * A section config of any form/output type. Used where configs of different sections are stored together.
 */

export type DbxLlmFlowAnySectionConfig = DbxLlmFlowSectionConfig<any, any>;

export interface DbxLlmFlowPersistenceConfig {
  readonly storageKey?: Maybe<string>;
  readonly maxRunsPerSection?: Maybe<number>;
  readonly debounceTime?: Maybe<number>;
}

export interface DbxLlmFlowConfig {
  readonly sections?: Maybe<readonly DbxLlmFlowAnySectionConfig[]>;
  /**
   * Whether only one run can run at a time across the whole flow.
   */
  readonly exclusiveRuns?: Maybe<boolean>;
  readonly runIdFactory?: Maybe<ModelIdFactory>;
  readonly describeRun?: Maybe<DbxLlmFlowDescribeRunFunction>;
  readonly persistence?: Maybe<DbxLlmFlowPersistenceConfig>;
}

// MARK: Binding Contract
export interface DbxLlmFlowSectionFormBinding {
  readonly id: DbxLlmFlowFormBindingId;
  readonly destroy: DestroyFunction;
}

/**
 * The contract a form (or any custom input) binds to. The section store implements it.
 */
export abstract class DbxLlmFlowSectionFormBindingTarget<F = unknown> {
  abstract registerFormBinding(): DbxLlmFlowSectionFormBinding;
  /**
   * Emits values the binding should seed its form with. Skips changes the binding made itself.
   */
  abstract formSeed$(id: DbxLlmFlowFormBindingId): Observable<Maybe<F>>;
  abstract readonly formLocked$: Observable<boolean>;
  abstract setDraftFormValue(id: DbxLlmFlowFormBindingId, value: Maybe<F>): void;
  abstract setFormValid(id: DbxLlmFlowFormBindingId, valid: boolean): void;
}

// MARK: Helpers
/**
 * Returns the kind, or the default kind.
 *
 * @param kind - The kind.
 * @returns The kind, or DEFAULT_DBX_LLM_FLOW_RUN_KIND.
 */
export function dbxLlmFlowRunKind(kind?: Maybe<DbxLlmFlowRunKind>): DbxLlmFlowRunKind {
  return kind ?? DEFAULT_DBX_LLM_FLOW_RUN_KIND;
}

/**
 * Converts an unknown error to a DbxLlmFlowRunError.
 *
 * @param input - The error.
 * @returns The run error.
 */
export function dbxLlmFlowRunErrorFromInput(input: unknown): DbxLlmFlowRunError {
  const error = toReadableError(input as Maybe<ErrorInput>) as Maybe<ReadableError>;
  return { code: error?.code, message: error?.message };
}

export interface DbxLlmFlowRunIdFactoryConfig {
  /**
   * Prefix of each id. Defaults to a per-session prefix.
   */
  readonly prefix?: Maybe<string>;
}

/**
 * Creates a sequential run id factory with a per-session prefix, so ids made by different sessions don't collide.
 *
 * @param config - Optional config.
 * @returns The id factory.
 */
export function dbxLlmFlowRunIdFactory(config?: Maybe<DbxLlmFlowRunIdFactoryConfig>): ModelIdFactory {
  const prefix = config?.prefix ?? Date.now().toString(36);
  return sequentialIncrementingNumberStringModelIdFactory({ startAt: 1, transform: (encoded) => `${prefix}-${encoded}` });
}
