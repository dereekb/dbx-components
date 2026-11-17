import { type ArrayOrValue, areEqualPOJOValues, asArray, findNonJsonCompatibleValue, jsonIncompatibilityMessage, type Maybe } from '@dereekb/util';
import { stripEmptyForgeValues } from '@dereekb/dbx-form';
import { type FieldDef } from '@ng-forge/dynamic-forms';
import {
  DBX_LLM_FLOW_RUN_CANCELLED_ERROR_CODE,
  DBX_LLM_FLOW_RUN_INTERRUPTED_ERROR_CODE,
  DBX_LLM_FLOW_RUN_NON_JSON_OUTPUT_ERROR_CODE,
  DEFAULT_DBX_LLM_FLOW_RUN_KIND,
  type DbxLlmFlowAnySectionConfig,
  type DbxLlmFlowConfig,
  type DbxLlmFlowFormBindingId,
  type DbxLlmFlowRawInputMode,
  type DbxLlmFlowRun,
  type DbxLlmFlowRunAvailability,
  type DbxLlmFlowRunBlockedReason,
  type DbxLlmFlowRunError,
  type DbxLlmFlowRunId,
  type DbxLlmFlowRunKind,
  type DbxLlmFlowRunRequest,
  type DbxLlmFlowRunRequestId,
  type DbxLlmFlowRunValue,
  type DbxLlmFlowSectionInput,
  type DbxLlmFlowSectionInputSource,
  type DbxLlmFlowSectionKey,
  type DbxLlmFlowSectionRunKindConfig,
  type DbxLlmFlowSectionState,
  type DbxLlmFlowState
} from './llm.flow';

// MARK: Context
/**
 * Everything a transition needs besides the state. Keeps transitions deterministic and testable.
 */
export interface DbxLlmFlowStateContext {
  readonly now: Date;
  readonly flowConfig?: Maybe<DbxLlmFlowConfig>;
  readonly sectionConfig: (key: DbxLlmFlowSectionKey) => Maybe<DbxLlmFlowAnySectionConfig>;
  readonly nextRequestId: () => DbxLlmFlowRunRequestId;
}

/**
 * The parts of the context that gating needs.
 */
export type DbxLlmFlowStateGatingContext = Pick<DbxLlmFlowStateContext, 'flowConfig' | 'sectionConfig'>;

/**
 * Where a selection came from. Only 'complete' can auto-run children.
 */
export type DbxLlmFlowSelectRunOrigin = 'complete' | 'load' | 'restore';

/**
 * Returns a new, empty flow state.
 *
 * @returns The initial state.
 */
export function initialDbxLlmFlowState(): DbxLlmFlowState {
  return { sections: {}, runs: {}, runRequests: {}, restoring: false };
}

// MARK: Config Helpers
/**
 * Whether the section has a form.
 *
 * @param config - The section config.
 * @returns True when the section has a form.
 */
export function dbxLlmFlowSectionHasForm(config: Maybe<DbxLlmFlowAnySectionConfig>): boolean {
  return config?.hasForm ?? (config?.formComponent != null || dbxLlmFlowSectionHasOptionFields(config));
}

/**
 * Whether the section declares option fields, shown in the raw input's form.
 *
 * @param config - The section config.
 * @returns True when the section has at least one option field.
 */
export function dbxLlmFlowSectionHasOptionFields(config: Maybe<DbxLlmFlowAnySectionConfig>): boolean {
  return Boolean(config?.optionFields?.length);
}

interface DbxLlmFlowOptionFieldShape {
  readonly key?: string;
  readonly type?: string;
  readonly label?: unknown;
  readonly fields?: readonly FieldDef<unknown>[];
}

function dbxLlmFlowOptionValueText(value: unknown): Maybe<string> {
  let text: Maybe<string>;

  if (Array.isArray(value)) {
    text = value.length ? value.map((x) => (typeof x === 'object' && x != null ? JSON.stringify(x) : String(x))).join(', ') : undefined;
  } else if (typeof value === 'object' && value != null) {
    text = JSON.stringify(value);
  } else if (value != null && value !== '') {
    text = String(value);
  }

  return text;
}

function collectDbxLlmFlowOptionParts(fields: readonly FieldDef<unknown>[], value: unknown, parts: string[]): void {
  const values = typeof value === 'object' && value != null ? (value as Record<string, unknown>) : undefined;

  for (const field of fields) {
    const { key, type, label, fields: children } = field as DbxLlmFlowOptionFieldShape;

    if (children != null) {
      // a group nests its fields' values under its key; rows and containers don't
      collectDbxLlmFlowOptionParts(children, type === 'group' && key ? values?.[key] : value, parts);
    } else if (key) {
      const text = dbxLlmFlowOptionValueText(values?.[key]);

      if (text != null) {
        parts.push(`${typeof label === 'string' && label ? label : key}: ${text}`);
      }
    }
  }
}

/**
 * Describes the options of a run for its history row: "Label: value" for each option field that has a value, joined by " · ". Groups nest
 * values under their key; rows and containers don't.
 *
 * @param optionFields - The section's option fields.
 * @param formValue - The run's form value (its options).
 * @returns The description, or undefined when no option has a value.
 */
export function dbxLlmFlowSectionOptionsDescription(optionFields: Maybe<readonly FieldDef<unknown>[]>, formValue: unknown): Maybe<string> {
  const parts: string[] = [];

  if (optionFields?.length) {
    collectDbxLlmFlowOptionParts(optionFields, formValue, parts);
  }

  return parts.length ? parts.join(' · ') : undefined;
}

/**
 * Whether the section's raw input is generated from its form value: the section has a form, its raw input config does not set the source to
 * "parent", and it has no option fields. Such a form (option fields, or a "parent" source) only adds options to the parent's output, and
 * never changes the raw input.
 *
 * @param config - The section config.
 * @returns True when the raw input follows the form value.
 */
export function dbxLlmFlowSectionRawInputFollowsForm(config: Maybe<DbxLlmFlowAnySectionConfig>): boolean {
  return dbxLlmFlowSectionHasForm(config) && config?.rawInput?.source !== 'parent' && !dbxLlmFlowSectionHasOptionFields(config);
}

/**
 * The raw input mode of the section. Defaults to 'two-way' when the raw input follows the form, and 'editable' otherwise.
 *
 * @param config - The section config.
 * @returns The raw input mode.
 */
export function dbxLlmFlowSectionRawInputMode(config: Maybe<DbxLlmFlowAnySectionConfig>): DbxLlmFlowRawInputMode {
  return config?.rawInput?.mode ?? (dbxLlmFlowSectionRawInputFollowsForm(config) ? 'two-way' : 'editable');
}

/**
 * Where the section's raw input comes from.
 *
 * - manual: the raw input is overridden, or the section takes its input from its parent but follows no parent run and has text.
 * - form: the section has a form, and its raw input config does not set the source to "parent".
 * - parent: the section takes its input from its parent (no form, or a raw input source of "parent") and follows a parent run.
 * - none: the section takes its input from its parent, follows no parent run and has no text.
 *
 * @param section - The section state.
 * @param config - The section config.
 * @returns The input source.
 */
export function dbxLlmFlowSectionInputSource(section: Maybe<DbxLlmFlowSectionState>, config: Maybe<DbxLlmFlowAnySectionConfig>): DbxLlmFlowSectionInputSource {
  let source: DbxLlmFlowSectionInputSource;

  if (section?.draft.rawInputOverridden) {
    source = 'manual';
  } else if (dbxLlmFlowSectionRawInputFollowsForm(config)) {
    source = 'form';
  } else if (section?.followedParentRunId != null) {
    source = 'parent';
  } else if (section?.draft.rawInput) {
    source = 'manual';
  } else {
    source = 'none';
  }

  return source;
}

/**
 * The run kinds of the section. Defaults to a single "Run" kind.
 *
 * @param config - The section config.
 * @returns The run kinds.
 */
export function dbxLlmFlowSectionRunKinds(config: Maybe<DbxLlmFlowAnySectionConfig>): readonly DbxLlmFlowSectionRunKindConfig<unknown, unknown>[] {
  const kinds = config?.kinds;
  return kinds?.length ? kinds : [{ kind: DEFAULT_DBX_LLM_FLOW_RUN_KIND, text: 'Run' }];
}

/**
 * Whether the section follows the parent run kind.
 *
 * @param config - The section config.
 * @param kind - The parent run kind.
 * @returns True when the section follows the kind.
 */
export function dbxLlmFlowSectionFollowsKind(config: Maybe<DbxLlmFlowAnySectionConfig>, kind: DbxLlmFlowRunKind): boolean {
  const follow = config?.followParentKinds;
  return follow == null || follow.includes(kind);
}

/**
 * The default toRawInput(): pretty JSON, or an empty string for no value.
 *
 * @param formValue - The form value.
 * @returns The raw input.
 */
export function defaultDbxLlmFlowToRawInput(formValue: unknown): string {
  return formValue == null ? '' : JSON.stringify(formValue, null, 2);
}

/**
 * The default fromRawInput(): JSON.parse() followed by a JSON compatibility check.
 *
 * @param rawInput - The raw input.
 * @returns The parsed value.
 * @throws {Error} When the raw input is not valid JSON.
 */
export function defaultDbxLlmFlowFromRawInput(rawInput: string): unknown {
  return JSON.parse(rawInput) as unknown;
}

function toRawInputForConfig(config: Maybe<DbxLlmFlowAnySectionConfig>, formValue: unknown): string {
  return (config?.toRawInput ?? defaultDbxLlmFlowToRawInput)(formValue);
}

function jsonIssueMessage(value: unknown): Maybe<string> {
  const issue = findNonJsonCompatibleValue(value);
  return issue ? jsonIncompatibilityMessage(issue) : undefined;
}

function isSameMaybe<T>(a: Maybe<T>, b: Maybe<T>): boolean {
  return (a ?? undefined) === (b ?? undefined);
}

function areEqualStringArrays(a: Maybe<readonly string[]>, b: Maybe<readonly string[]>): boolean {
  const x = a ?? [];
  const y = b ?? [];
  return x.length === y.length && x.every((value, i) => value === y[i]);
}

/**
 * Computes the issues that block the section's input from running.
 *
 * @param section - The section state.
 * @param config - The section config.
 * @returns The issues, or undefined when there are none.
 */
export function dbxLlmFlowSectionInputIssues(section: Pick<DbxLlmFlowSectionState, 'draft' | 'rawInputParseError' | 'formValueError'>, config: Maybe<DbxLlmFlowAnySectionConfig>): Maybe<string[]> {
  const issues: string[] = [];

  if (!config?.allowEmptyInput && !section.draft.rawInput.trim()) {
    issues.push('The input is empty.');
  }

  if (section.rawInputParseError) {
    issues.push(section.rawInputParseError);
  }

  if (section.formValueError) {
    issues.push(section.formValueError);
  }

  if (config?.validateInput) {
    const messages = asArray(config.validateInput(section.draft) as Maybe<ArrayOrValue<string>>).filter(Boolean);
    issues.push(...messages);
  }

  return issues.length ? issues : undefined;
}

// MARK: Topology
/**
 * Returns the keys of the section's registered children, in registration order.
 *
 * @param state - The state.
 * @param key - The section key.
 * @returns The child keys.
 */
export function dbxLlmFlowSectionChildKeys(state: Pick<DbxLlmFlowState, 'sections'>, key: DbxLlmFlowSectionKey): DbxLlmFlowSectionKey[] {
  return Object.values(state.sections)
    .filter((x) => x.parentKey === key)
    .map((x) => x.key);
}

/**
 * Returns the keys of the section's registered ancestors, nearest first. Stops at an unknown parent or a cycle.
 *
 * @param state - The state.
 * @param key - The section key.
 * @returns The ancestor keys.
 */
export function dbxLlmFlowSectionAncestorKeys(state: Pick<DbxLlmFlowState, 'sections'>, key: DbxLlmFlowSectionKey): DbxLlmFlowSectionKey[] {
  const ancestors: DbxLlmFlowSectionKey[] = [];
  const visited = new Set<DbxLlmFlowSectionKey>([key]);
  let parentKey = state.sections[key]?.parentKey;

  while (parentKey != null && state.sections[parentKey] != null && !visited.has(parentKey)) {
    ancestors.push(parentKey);
    visited.add(parentKey);
    parentKey = state.sections[parentKey].parentKey;
  }

  return ancestors;
}

/**
 * Returns the keys of every registered descendant of the section.
 *
 * @param state - The state.
 * @param key - The section key.
 * @returns The descendant keys, breadth first.
 */
export function dbxLlmFlowSectionDescendantKeys(state: Pick<DbxLlmFlowState, 'sections'>, key: DbxLlmFlowSectionKey): DbxLlmFlowSectionKey[] {
  const descendants: DbxLlmFlowSectionKey[] = [];
  const visited = new Set<DbxLlmFlowSectionKey>([key]);
  const queue = [key];

  while (queue.length) {
    const current = queue.shift() as DbxLlmFlowSectionKey;

    for (const child of dbxLlmFlowSectionChildKeys(state, current)) {
      if (!visited.has(child)) {
        visited.add(child);
        descendants.push(child);
        queue.push(child);
      }
    }
  }

  return descendants;
}

/**
 * Returns the run's lineage, root first, ending with the run itself. Stops at a missing run or a cycle.
 *
 * @param state - The state.
 * @param runId - The run id.
 * @returns The lineage, or an empty array when the run doesn't exist.
 */
export function dbxLlmFlowRunLineage(state: Pick<DbxLlmFlowState, 'runs'>, runId: Maybe<DbxLlmFlowRunId>): DbxLlmFlowRun[] {
  const lineage: DbxLlmFlowRun[] = [];
  const visited = new Set<DbxLlmFlowRunId>();
  let run = runId == null ? undefined : state.runs[runId];

  while (run != null && !visited.has(run.id)) {
    lineage.unshift(run);
    visited.add(run.id);
    run = run.parentRunId == null ? undefined : state.runs[run.parentRunId];
  }

  return lineage;
}

/**
 * Returns the section's selected runs, in selection order. The last is the primary selection.
 *
 * @param state - The state.
 * @param key - The section key.
 * @returns The selected runs.
 */
export function dbxLlmFlowSectionSelectedRuns(state: DbxLlmFlowState, key: DbxLlmFlowSectionKey): DbxLlmFlowRun[] {
  const section = state.sections[key];
  return (section?.selectedRunIds ?? []).map((id) => state.runs[id]).filter((x): x is DbxLlmFlowRun => x != null);
}

function compareRunsByStart(a: DbxLlmFlowRun, b: DbxLlmFlowRun): number {
  return a.startedAt.getTime() - b.startedAt.getTime();
}

/**
 * Returns the section's runs, oldest first.
 *
 * @param state - The state.
 * @param key - The section key.
 * @returns The runs.
 */
export function dbxLlmFlowSectionRuns(state: Pick<DbxLlmFlowState, 'runs'>, key: DbxLlmFlowSectionKey): DbxLlmFlowRun[] {
  return Object.values(state.runs)
    .filter((x) => x.sectionKey === key)
    .sort(compareRunsByStart);
}

// MARK: Availability
/**
 * Returns whether the section can run right now, and if not, the first reason in gating order.
 *
 * @param state - The state.
 * @param key - The section key.
 * @param context - The gating context.
 * @returns The availability.
 */
export function dbxLlmFlowSectionRunAvailability(state: DbxLlmFlowState, key: DbxLlmFlowSectionKey, context: DbxLlmFlowStateGatingContext): DbxLlmFlowRunAvailability {
  const section = state.sections[key];
  const config = context.sectionConfig(key);
  let blockedReason: Maybe<DbxLlmFlowRunBlockedReason>;

  if (section == null) {
    blockedReason = 'unknown_section';
  } else if (state.restoring) {
    blockedReason = 'restoring';
  } else if (section.activeRunId != null) {
    blockedReason = 'running';
  } else if (context.flowConfig?.exclusiveRuns && Object.values(state.runs).some((x) => x.state === 'running')) {
    blockedReason = 'exclusive_running';
  } else if (isAncestorRunningForSection(state, key, context)) {
    blockedReason = 'ancestor_running';
  } else if (config?.requireParentRun && section.parentKey != null && section.followedParentRunId == null) {
    blockedReason = 'parent_run_required';
  } else if (section.inputIssues?.length) {
    blockedReason = 'invalid_input';
  } else if (section.formValid === false && !section.draft.rawInputOverridden) {
    blockedReason = 'invalid_form';
  }

  return { canRun: blockedReason == null, blockedReason };
}

function isAncestorRunningForSection(state: DbxLlmFlowState, key: DbxLlmFlowSectionKey, context: DbxLlmFlowStateGatingContext): boolean {
  let childKey = key;
  let running = false;

  for (const ancestorKey of dbxLlmFlowSectionAncestorKeys(state, key)) {
    const activeRunId = state.sections[ancestorKey].activeRunId;
    const activeRun = activeRunId == null ? undefined : state.runs[activeRunId];

    if (activeRun != null && dbxLlmFlowSectionFollowsKind(context.sectionConfig(childKey), activeRun.kind)) {
      running = true;
      break;
    }

    childKey = ancestorKey;
  }

  return running;
}

// MARK: Mutator
/**
 * Copy-on-write working copy of a state. finish() returns the original state reference when nothing changed.
 */
class DbxLlmFlowStateMutator {
  private _sections?: Record<DbxLlmFlowSectionKey, DbxLlmFlowSectionState>;
  private _runs?: Record<DbxLlmFlowRunId, DbxLlmFlowRun>;
  private _runRequests?: Record<DbxLlmFlowSectionKey, DbxLlmFlowRunRequest>;
  private _patch?: Partial<Pick<DbxLlmFlowState, 'restoring' | 'storageKey'>>;

  constructor(
    readonly original: DbxLlmFlowState,
    readonly context: DbxLlmFlowStateContext
  ) {}

  get state(): DbxLlmFlowState {
    return {
      ...this.original,
      ...this._patch,
      sections: this._sections ?? this.original.sections,
      runs: this._runs ?? this.original.runs,
      runRequests: this._runRequests ?? this.original.runRequests
    };
  }

  section(key: DbxLlmFlowSectionKey): Maybe<DbxLlmFlowSectionState> {
    return (this._sections ?? this.original.sections)[key];
  }

  run(id: Maybe<DbxLlmFlowRunId>): Maybe<DbxLlmFlowRun> {
    return id == null ? undefined : (this._runs ?? this.original.runs)[id];
  }

  config(key: DbxLlmFlowSectionKey): Maybe<DbxLlmFlowAnySectionConfig> {
    return this.context.sectionConfig(key);
  }

  setSection(section: DbxLlmFlowSectionState): void {
    if (this.section(section.key) !== section) {
      this._sections = this._sections ?? { ...this.original.sections };
      this._sections[section.key] = section;
    }
  }

  updateSection(key: DbxLlmFlowSectionKey, patch: Partial<DbxLlmFlowSectionState>): void {
    const section = this.section(key);

    if (section != null) {
      const changed = Object.entries(patch).some(([field, value]) => {
        const current = section[field as keyof DbxLlmFlowSectionState];
        return Array.isArray(value) || Array.isArray(current) ? !areEqualStringArrays(current as Maybe<string[]>, value as Maybe<string[]>) : !isSameMaybe(current, value);
      });

      if (changed) {
        this.setSection({ ...section, ...patch });
      }
    }
  }

  setRun(run: DbxLlmFlowRun): void {
    this._runs = this._runs ?? { ...this.original.runs };
    this._runs[run.id] = run;
  }

  setRunRequest(key: DbxLlmFlowSectionKey, request: Maybe<DbxLlmFlowRunRequest>): void {
    const current = (this._runRequests ?? this.original.runRequests)[key];

    if (current !== request && !(current == null && request == null)) {
      this._runRequests = this._runRequests ?? { ...this.original.runRequests };

      if (request == null) {
        delete this._runRequests[key];
      } else {
        this._runRequests[key] = request;
      }
    }
  }

  patchState(patch: Partial<Pick<DbxLlmFlowState, 'restoring' | 'storageKey'>>): void {
    this._patch = { ...this._patch, ...patch };
  }

  finish(): DbxLlmFlowState {
    const patchChanged = this._patch != null && Object.entries(this._patch).some(([field, value]) => !isSameMaybe(this.original[field as keyof DbxLlmFlowState], value));
    return this._sections || this._runs || this._runRequests || patchChanged ? this.state : this.original;
  }
}

// MARK: Draft
interface ApplyDraftInput {
  readonly draft: DbxLlmFlowSectionInput;
  readonly draftSource?: Maybe<DbxLlmFlowFormBindingId>;
  readonly rawInputParseError?: Maybe<string>;
  readonly formValueError?: Maybe<string>;
}

/**
 * Applies a draft change: bumps the revision, recomputes the input issues and drops any pending run request.
 *
 * @param m - The mutator.
 * @param key - The section key.
 * @param input - The draft change.
 */
function applyDraft(m: DbxLlmFlowStateMutator, key: DbxLlmFlowSectionKey, input: ApplyDraftInput): void {
  const section = m.section(key);

  if (section != null) {
    const next: DbxLlmFlowSectionState = {
      ...section,
      draft: input.draft,
      draftRevision: section.draftRevision + 1,
      draftSource: input.draftSource,
      rawInputParseError: input.rawInputParseError,
      formValueError: input.formValueError
    };

    m.setSection({ ...next, inputIssues: dbxLlmFlowSectionInputIssues(next, m.config(key)) });
    m.setRunRequest(key, undefined);
  }
}

/**
 * Builds a store-originated draft from a (partial) input. A non-JSON form value is rejected and reported as formValueError.
 *
 * @param m - The mutator.
 * @param key - The section key.
 * @param input - The partial input.
 * @param base - The draft to build on.
 * @returns The draft change.
 */
function storeDraftChange(m: DbxLlmFlowStateMutator, key: DbxLlmFlowSectionKey, input: Partial<DbxLlmFlowSectionInput>, base: DbxLlmFlowSectionInput): ApplyDraftInput {
  const config = m.config(key);
  const hasFormValue = 'formValue' in input;
  const formValueError = hasFormValue ? jsonIssueMessage(input.formValue) : undefined;
  const formValue = hasFormValue && !formValueError ? input.formValue : base.formValue;
  const followsForm = dbxLlmFlowSectionRawInputFollowsForm(config);
  const rawInputOverridden = followsForm ? Boolean(input.rawInputOverridden ?? (input.rawInput != null && !hasFormValue)) : Boolean(input.rawInputOverridden);
  const keepsRawInput = rawInputOverridden || (!followsForm && dbxLlmFlowSectionHasForm(config));
  const rawInput = input.rawInput ?? (keepsRawInput ? base.rawInput : toRawInputForConfig(config, formValue));
  return { draft: { formValue, rawInput, rawInputOverridden }, formValueError };
}

function initialSectionDraft(config: Maybe<DbxLlmFlowAnySectionConfig>): DbxLlmFlowSectionInput {
  const initial = config?.initialDraft;
  const formValue = initial?.formValue;
  const generatedRawInput = dbxLlmFlowSectionRawInputFollowsForm(config) || !dbxLlmFlowSectionHasForm(config) ? toRawInputForConfig(config, formValue) : '';
  return {
    formValue,
    rawInput: initial?.rawInput ?? generatedRawInput,
    rawInputOverridden: Boolean(initial?.rawInputOverridden)
  };
}

/**
 * Creates the initial state of a section.
 *
 * @param key - The section key.
 * @param parentKey - The parent section key.
 * @param config - The section config.
 * @returns The section state.
 */
export function initialDbxLlmFlowSectionState(key: DbxLlmFlowSectionKey, parentKey: Maybe<DbxLlmFlowSectionKey>, config: Maybe<DbxLlmFlowAnySectionConfig>): DbxLlmFlowSectionState {
  const base: DbxLlmFlowSectionState = { key, parentKey, draft: initialSectionDraft(config), selectedRunIds: [], draftRevision: 0, mountCount: 0 };
  return { ...base, inputIssues: dbxLlmFlowSectionInputIssues(base, config) };
}

// MARK: Cascade
function selectRun(m: DbxLlmFlowStateMutator, run: DbxLlmFlowRun, origin: DbxLlmFlowSelectRunOrigin, forcedPath: readonly DbxLlmFlowRun[]): void {
  const key = run.sectionKey;
  const section = m.section(key);

  if (section != null) {
    if (origin !== 'complete') {
      applyDraft(m, key, { draft: { ...run.input } });
    }

    const selectedRunIds = (m.section(key) as DbxLlmFlowSectionState).selectedRunIds.filter((id) => id !== run.id && m.run(id)?.kind !== run.kind);
    m.updateSection(key, { selectedRunIds: [...selectedRunIds, run.id] });
    cascadeToChildren(m, run, origin, forcedPath);
  }
}

function cascadeToChildren(m: DbxLlmFlowStateMutator, run: DbxLlmFlowRun, origin: DbxLlmFlowSelectRunOrigin, forcedPath: readonly DbxLlmFlowRun[]): void {
  const nextForced = forcedPath[0];

  for (const childKey of dbxLlmFlowSectionChildKeys(m.state, run.sectionKey)) {
    if (nextForced?.sectionKey === childKey) {
      m.updateSection(childKey, { followedParentRunId: run.id });
      selectRun(m, nextForced, 'load', forcedPath.slice(1));
    } else if (dbxLlmFlowSectionFollowsKind(m.config(childKey), run.kind)) {
      cascadeToChild(m, run, childKey, origin);
    }
  }
}

function cascadeToChild(m: DbxLlmFlowStateMutator, parentRun: DbxLlmFlowRun, childKey: DbxLlmFlowSectionKey, origin: Maybe<DbxLlmFlowSelectRunOrigin>): void {
  m.updateSection(childKey, { followedParentRunId: parentRun.id });

  const childRuns = dbxLlmFlowSectionRuns(m.state, childKey).filter((x) => x.parentRunId === parentRun.id && x.state === 'success');

  if (childRuns.length) {
    // Restore: select the latest run per kind, and recurse from those anchors.
    const latestPerKind = new Map<DbxLlmFlowRunKind, DbxLlmFlowRun>();
    childRuns.forEach((x) => latestPerKind.set(x.kind, x));
    const anchors = Array.from(latestPerKind.values()).sort(compareRunsByStart);
    const latest = anchors[anchors.length - 1];

    applyDraft(m, childKey, { draft: { ...latest.input } });
    m.updateSection(childKey, { selectedRunIds: anchors.map((x) => x.id) });
    anchors.forEach((anchor) => cascadeToChildren(m, anchor, 'restore', []));
  } else {
    deriveChildFromParentRun(m, parentRun, childKey, origin);
  }
}

/**
 * The draft update a section derives from its parent run's output: the config's fromParentOutput(), or a string output as the raw input of a
 * section whose raw input does not follow a form (no form, or a raw input source of "parent").
 *
 * @param config - The section config.
 * @param parentRun - The parent run.
 * @param draft - The section's current draft.
 * @returns The update, or undefined to keep the draft.
 */
function parentOutputDraftUpdate(config: Maybe<DbxLlmFlowAnySectionConfig>, parentRun: DbxLlmFlowRun, draft: DbxLlmFlowSectionInput): Maybe<Partial<DbxLlmFlowSectionInput>> {
  const fromParentOutput = config?.fromParentOutput;
  let update: Maybe<Partial<DbxLlmFlowSectionInput>>;

  if (fromParentOutput) {
    update = fromParentOutput({ parentRun, parentOutput: parentRun.output, draft });
  } else if (!dbxLlmFlowSectionRawInputFollowsForm(config) && typeof parentRun.output === 'string') {
    update = { rawInput: parentRun.output };
  }

  return update;
}

function deriveChildFromParentRun(m: DbxLlmFlowStateMutator, parentRun: DbxLlmFlowRun, childKey: DbxLlmFlowSectionKey, origin: Maybe<DbxLlmFlowSelectRunOrigin>): void {
  const config = m.config(childKey);
  const child = m.section(childKey) as DbxLlmFlowSectionState;
  m.updateSection(childKey, { selectedRunIds: [] });

  const update = parentOutputDraftUpdate(config, parentRun, child.draft);

  if (update != null) {
    applyDraft(m, childKey, storeDraftChange(m, childKey, { rawInputOverridden: false, ...update }, child.draft));
  }

  // Clear the selections and anchors of all descendants. Their drafts are kept.
  for (const descendantKey of dbxLlmFlowSectionDescendantKeys(m.state, childKey)) {
    m.updateSection(descendantKey, { selectedRunIds: [], followedParentRunId: undefined });
  }

  if (origin === 'complete' && config?.autoRunAfterParent) {
    const kind = config.autoRunAfterParent === true ? dbxLlmFlowSectionRunKinds(config)[0].kind : config.autoRunAfterParent;
    const updatedChild = m.section(childKey) as DbxLlmFlowSectionState;

    if ((updatedChild.runBridgeCounts?.[kind] ?? 0) > 0) {
      m.setRunRequest(childKey, { id: m.context.nextRequestId(), kind, draftRevision: updatedChild.draftRevision });
    }
  }
}

/**
 * Reconciles the section, then its children, against the parent's current selection. Never auto-runs.
 *
 * @param m - The mutator.
 * @param key - The section key.
 * @param visited - Visited keys, for cycle safety.
 */
function reconcileSection(m: DbxLlmFlowStateMutator, key: DbxLlmFlowSectionKey, visited: Set<DbxLlmFlowSectionKey>): void {
  const section = m.section(key);

  if (section != null && !visited.has(key)) {
    visited.add(key);
    const config = m.config(key);
    const parentSelectedRunIds = section.parentKey == null ? [] : (m.section(section.parentKey)?.selectedRunIds ?? []);
    const anchor = [...parentSelectedRunIds]
      .reverse()
      .map((id) => m.run(id))
      .find((x) => x?.state === 'success' && dbxLlmFlowSectionFollowsKind(config, x.kind));

    if (anchor != null && anchor.id !== section.followedParentRunId) {
      cascadeToChild(m, anchor, key, undefined);
    }

    dbxLlmFlowSectionChildKeys(m.state, key).forEach((childKey) => reconcileSection(m, childKey, visited));
  }
}

// MARK: Registration
export interface DbxLlmFlowRegisterSectionInput {
  readonly key: DbxLlmFlowSectionKey;
  readonly parentKey?: Maybe<DbxLlmFlowSectionKey>;
}

/**
 * Registers (mounts) a section. Creates its state on first registration, then reconciles it and its children against the parent's selection.
 *
 * @param state - The state.
 * @param input - The section to register.
 * @param context - The context.
 * @returns The new state.
 * @throws {Error} When the parentKey creates a cycle.
 */
export function dbxLlmFlowStateWithRegisteredSection(state: DbxLlmFlowState, input: DbxLlmFlowRegisterSectionInput, context: DbxLlmFlowStateContext): DbxLlmFlowState {
  const { key } = input;
  const parentKey = input.parentKey ?? undefined;
  const visited = new Set<DbxLlmFlowSectionKey>();
  let current = parentKey;

  while (current != null && state.sections[current] != null) {
    if (current === key || visited.has(current)) {
      throw new Error(`dbxLlmFlow: registering section "${key}" with parent "${parentKey}" creates a cycle.`);
    }

    visited.add(current);
    current = state.sections[current].parentKey ?? undefined;
  }

  if (current === key) {
    throw new Error(`dbxLlmFlow: section "${key}" can't be its own parent.`);
  }

  const m = new DbxLlmFlowStateMutator(state, context);
  const existing = state.sections[key] ?? initialDbxLlmFlowSectionState(key, parentKey, context.sectionConfig(key));
  m.setSection({ ...existing, parentKey, mountCount: existing.mountCount + 1 });
  reconcileSection(m, key, new Set());
  return m.finish();
}

/**
 * Unregisters (unmounts) a section. Its state outlives unmounting, so cascades still reach it.
 *
 * @param state - The state.
 * @param key - The section key.
 * @returns The new state.
 */
export function dbxLlmFlowStateWithUnregisteredSection(state: DbxLlmFlowState, key: DbxLlmFlowSectionKey): DbxLlmFlowState {
  const section = state.sections[key];
  return section == null ? state : { ...state, sections: { ...state.sections, [key]: { ...section, mountCount: Math.max(0, section.mountCount - 1) } } };
}

// MARK: Runs
export interface DbxLlmFlowStartRunInput {
  readonly sectionKey: DbxLlmFlowSectionKey;
  readonly kind: DbxLlmFlowRunKind;
  readonly runId: DbxLlmFlowRunId;
}

export interface DbxLlmFlowStartRunResult {
  readonly state: DbxLlmFlowState;
  readonly value?: Maybe<DbxLlmFlowRunValue>;
  readonly blockedReason?: Maybe<DbxLlmFlowRunBlockedReason>;
}

/**
 * Starts a run with the section's current draft, unless the section is blocked.
 *
 * @param state - The state.
 * @param input - The run to start.
 * @param context - The context.
 * @returns The new state, plus the run value or the blocked reason.
 */
export function dbxLlmFlowStateWithStartedRun(state: DbxLlmFlowState, input: DbxLlmFlowStartRunInput, context: DbxLlmFlowStateContext): DbxLlmFlowStartRunResult {
  const { sectionKey, kind, runId } = input;
  const availability = dbxLlmFlowSectionRunAvailability(state, sectionKey, context);
  let result: DbxLlmFlowStartRunResult;

  if (availability.canRun) {
    const section = state.sections[sectionKey];
    const run: DbxLlmFlowRun = { id: runId, sectionKey, kind, parentRunId: section.followedParentRunId, input: section.draft, state: 'running', startedAt: context.now };
    const m = new DbxLlmFlowStateMutator(state, context);
    m.setRun(run);
    m.updateSection(sectionKey, { activeRunId: runId });
    m.setRunRequest(sectionKey, undefined);

    const parentRun = run.parentRunId == null ? undefined : state.runs[run.parentRunId];
    const value: DbxLlmFlowRunValue = { runId, sectionKey, kind, input: section.draft, parentRun, lineage: dbxLlmFlowRunLineage(state, parentRun?.id) };
    result = { state: m.finish(), value };
  } else {
    result = { state, blockedReason: availability.blockedReason };
  }

  return result;
}

export interface DbxLlmFlowCompleteRunInput {
  readonly runId: DbxLlmFlowRunId;
  readonly output?: unknown;
  readonly data?: unknown;
}

/**
 * Completes a running run. Selects it (and cascades) only when it is the section's active run and still on the current branch.
 *
 * A non-JSON output fails the run with DBX_LLM_FLOW_RUN_NON_JSON_OUTPUT_ERROR_CODE. Runs that aren't running are left unchanged.
 *
 * @param state - The state.
 * @param input - The completion.
 * @param context - The context.
 * @returns The new state.
 */
export function dbxLlmFlowStateWithCompletedRun(state: DbxLlmFlowState, input: DbxLlmFlowCompleteRunInput, context: DbxLlmFlowStateContext): DbxLlmFlowState {
  const run = state.runs[input.runId];
  let result = state;

  if (run?.state === 'running') {
    const outputIssue = jsonIssueMessage(input.output) ?? jsonIssueMessage(input.data);

    if (outputIssue) {
      result = dbxLlmFlowStateWithFailedRun(state, { runId: run.id, error: { code: DBX_LLM_FLOW_RUN_NON_JSON_OUTPUT_ERROR_CODE, message: outputIssue } }, context);
    } else {
      const m = new DbxLlmFlowStateMutator(state, context);
      const completed: DbxLlmFlowRun = { ...run, state: 'success', output: input.output, data: (input.data ?? run.data) as DbxLlmFlowRun['data'], finishedAt: context.now };
      m.setRun(completed);

      const section = state.sections[run.sectionKey];

      if (section?.activeRunId === run.id) {
        m.updateSection(run.sectionKey, { activeRunId: undefined, lastFailedRunId: undefined });

        if (isSameMaybe(run.parentRunId, section.followedParentRunId)) {
          selectRun(m, completed, 'complete', []);
        }
      }

      result = m.finish();
    }
  }

  return result;
}

export interface DbxLlmFlowFailRunInput {
  readonly runId: DbxLlmFlowRunId;
  readonly error?: Maybe<DbxLlmFlowRunError>;
}

/**
 * Fails a running run. Failed runs are never selected. Runs that aren't running are left unchanged.
 *
 * @param state - The state.
 * @param input - The failure.
 * @param context - The context.
 * @returns The new state.
 */
export function dbxLlmFlowStateWithFailedRun(state: DbxLlmFlowState, input: DbxLlmFlowFailRunInput, context: DbxLlmFlowStateContext): DbxLlmFlowState {
  const run = state.runs[input.runId];
  let result = state;

  if (run?.state === 'running') {
    const m = new DbxLlmFlowStateMutator(state, context);
    m.setRun({ ...run, state: 'failed', error: input.error ?? {}, finishedAt: context.now });

    if (state.sections[run.sectionKey]?.activeRunId === run.id) {
      m.updateSection(run.sectionKey, { activeRunId: undefined, lastFailedRunId: run.id });
    }

    result = m.finish();
  }

  return result;
}

/**
 * Cancels a running run by failing it with DBX_LLM_FLOW_RUN_CANCELLED_ERROR_CODE.
 *
 * @param state - The state.
 * @param runId - The run id.
 * @param context - The context.
 * @returns The new state.
 */
export function dbxLlmFlowStateWithCancelledRun(state: DbxLlmFlowState, runId: DbxLlmFlowRunId, context: DbxLlmFlowStateContext): DbxLlmFlowState {
  return dbxLlmFlowStateWithFailedRun(state, { runId, error: { code: DBX_LLM_FLOW_RUN_CANCELLED_ERROR_CODE, message: 'The run was cancelled.' } }, context);
}

/**
 * Selects a run directly. Used by imports; history loads use dbxLlmFlowStateWithLoadedRun().
 *
 * @param state - The state.
 * @param runId - The run id.
 * @param origin - Where the selection came from.
 * @param context - The context.
 * @returns The new state.
 */
export function dbxLlmFlowStateWithSelectedRun(state: DbxLlmFlowState, runId: DbxLlmFlowRunId, origin: DbxLlmFlowSelectRunOrigin, context: DbxLlmFlowStateContext): DbxLlmFlowState {
  const run = state.runs[runId];
  let result = state;

  if (run?.state === 'success') {
    const m = new DbxLlmFlowStateMutator(state, context);
    selectRun(m, run, origin, []);
    result = m.finish();
  }

  return result;
}

export interface DbxLlmFlowLoadRunInput {
  readonly runId: DbxLlmFlowRunId;
  /**
   * Also loads the run's ancestors, walking parentRunId while the parent exists, succeeded and belongs to the parent section.
   */
  readonly withAncestors?: Maybe<boolean>;
}

export interface DbxLlmFlowLoadRunResult {
  readonly state: DbxLlmFlowState;
  readonly loaded: boolean;
}

/**
 * Loads a run from history: restores its input, selects it and cascades to the descendants.
 *
 * Blocked while the section (or, with ancestors, any section on the path) is running. A failed run restores its input only.
 *
 * @param state - The state.
 * @param input - The run to load.
 * @param context - The context.
 * @returns The new state, and whether the run was loaded.
 */
export function dbxLlmFlowStateWithLoadedRun(state: DbxLlmFlowState, input: DbxLlmFlowLoadRunInput, context: DbxLlmFlowStateContext): DbxLlmFlowLoadRunResult {
  const run = state.runs[input.runId];
  const section = run == null ? undefined : state.sections[run.sectionKey];
  let result: DbxLlmFlowLoadRunResult = { state, loaded: false };

  if (run != null && section != null && section.activeRunId == null && run.state !== 'running') {
    const m = new DbxLlmFlowStateMutator(state, context);

    if (run.state === 'failed') {
      applyDraft(m, run.sectionKey, { draft: { ...run.input } });
      result = { state: m.finish(), loaded: true };
    } else if (input.withAncestors) {
      const path = loadRunAncestorPath(state, run);

      if (!path.some((x) => state.sections[x.sectionKey]?.activeRunId != null)) {
        selectRun(m, path[0], 'load', path.slice(1));
        result = { state: m.finish(), loaded: true };
      }
    } else {
      selectRun(m, run, 'load', []);
      result = { state: m.finish(), loaded: true };
    }
  }

  return result;
}

function loadRunAncestorPath(state: DbxLlmFlowState, run: DbxLlmFlowRun): DbxLlmFlowRun[] {
  const path = [run];
  const visited = new Set<DbxLlmFlowRunId>([run.id]);
  let current = run;

  while (current.parentRunId != null) {
    const parent = state.runs[current.parentRunId];

    if (parent == null || visited.has(parent.id) || parent.state !== 'success' || parent.sectionKey !== state.sections[current.sectionKey]?.parentKey) {
      break;
    }

    path.unshift(parent);
    visited.add(parent.id);
    current = parent;
  }

  return path;
}

// MARK: Draft Transitions
export interface DbxLlmFlowLoadDraftInput {
  readonly key: DbxLlmFlowSectionKey;
  readonly input: Partial<DbxLlmFlowSectionInput>;
}

/**
 * Replaces the section's draft from the store (e.g. Reroll). A non-JSON form value is rejected into the input issues.
 *
 * @param state - The state.
 * @param input - The draft.
 * @param context - The context.
 * @returns The new state.
 */
export function dbxLlmFlowStateWithDraft(state: DbxLlmFlowState, input: DbxLlmFlowLoadDraftInput, context: DbxLlmFlowStateContext): DbxLlmFlowState {
  const section = state.sections[input.key];
  let result = state;

  if (section != null) {
    const m = new DbxLlmFlowStateMutator(state, context);
    applyDraft(m, input.key, storeDraftChange(m, input.key, input.input, section.draft));
    result = m.finish();
  }

  return result;
}

export interface DbxLlmFlowSetDraftFormValueInput {
  readonly key: DbxLlmFlowSectionKey;
  readonly bindingId: DbxLlmFlowFormBindingId;
  readonly formValue: unknown;
}

/**
 * Applies a value pushed by a bound form.
 *
 * - A non-JSON value is rejected into the input issues.
 * - Regenerates the raw input when it follows the form. Ignored while that raw input is overridden.
 * - Keeps the raw input (and its override) when the form only adds options to the parent's output (a raw input source of "parent").
 * - A value deep-equal to the draft returns the same state (the echo no-op that ends multi-instance sync ping-pong).
 *
 * @param state - The state.
 * @param input - The pushed value.
 * @param context - The context.
 * @returns The new state.
 */
export function dbxLlmFlowStateWithDraftFormValue(state: DbxLlmFlowState, input: DbxLlmFlowSetDraftFormValueInput, context: DbxLlmFlowStateContext): DbxLlmFlowState {
  const { key, bindingId, formValue } = input;
  const section = state.sections[key];
  const followsForm = dbxLlmFlowSectionRawInputFollowsForm(context.sectionConfig(key));
  let result = state;

  if (section != null && (!followsForm || !section.draft.rawInputOverridden)) {
    const m = new DbxLlmFlowStateMutator(state, context);
    const formValueError = jsonIssueMessage(formValue);

    if (formValueError) {
      if (formValueError !== section.formValueError) {
        const next = { ...section, formValueError };
        m.setSection({ ...next, inputIssues: dbxLlmFlowSectionInputIssues(next, m.config(key)) });
      }
    } else if (areEqualPOJOValues(stripEmptyForgeValues(formValue), stripEmptyForgeValues(section.draft.formValue))) {
      if (section.formValueError) {
        const next = { ...section, formValueError: undefined };
        m.setSection({ ...next, inputIssues: dbxLlmFlowSectionInputIssues(next, m.config(key)) });
      }
    } else {
      const draft: DbxLlmFlowSectionInput = followsForm ? { formValue, rawInput: toRawInputForConfig(m.config(key), formValue), rawInputOverridden: false } : { ...section.draft, formValue };
      applyDraft(m, key, { draft, draftSource: bindingId });
    }

    result = m.finish();
  }

  return result;
}

export interface DbxLlmFlowSetFormValidInput {
  readonly key: DbxLlmFlowSectionKey;
  readonly valid: Maybe<boolean>;
}

/**
 * Sets whether the bound form is valid.
 *
 * @param state - The state.
 * @param input - The validity.
 * @returns The new state.
 */
export function dbxLlmFlowStateWithFormValid(state: DbxLlmFlowState, input: DbxLlmFlowSetFormValidInput): DbxLlmFlowState {
  const section = state.sections[input.key];
  return section != null && !isSameMaybe(section.formValid, input.valid) ? { ...state, sections: { ...state.sections, [input.key]: { ...section, formValid: input.valid } } } : state;
}

export interface DbxLlmFlowSetCollapsedInput {
  readonly key: DbxLlmFlowSectionKey;
  readonly collapsed: boolean;
}

/**
 * Sets whether a section is collapsed to its header.
 *
 * @param state - The state.
 * @param input - The collapsed state.
 * @returns The new state.
 */
export function dbxLlmFlowStateWithCollapsed(state: DbxLlmFlowState, input: DbxLlmFlowSetCollapsedInput): DbxLlmFlowState {
  const section = state.sections[input.key];
  return section != null && Boolean(section.collapsed) !== input.collapsed ? { ...state, sections: { ...state.sections, [input.key]: { ...section, collapsed: input.collapsed } } } : state;
}

export interface DbxLlmFlowPasteRawInputInput {
  readonly key: DbxLlmFlowSectionKey;
  readonly rawInput: string;
  /**
   * Whether the text was typed rather than pasted. Typed text is ignored in one-way mode, and kept as typed (not regenerated) in two-way mode.
   */
  readonly typed?: Maybe<boolean>;
}

/**
 * Applies pasted (or typed) raw input.
 *
 * - two-way: parses the text back into the form value. A paste regenerates the raw input from the parsed value, while typed text is kept as
 *   typed. Text that fails to parse overrides the form with a parse error until it parses. A section whose raw input does not follow its form
 *   (a raw input source of "parent") behaves as editable.
 * - one-way: keeps the exact pasted text and sets the override. Typed text is ignored.
 * - editable: keeps the exact text and sets the override.
 * - readonly: ignored.
 *
 * @param state - The state.
 * @param input - The raw input.
 * @param context - The context.
 * @returns The new state.
 */
export function dbxLlmFlowStateWithPastedRawInput(state: DbxLlmFlowState, input: DbxLlmFlowPasteRawInputInput, context: DbxLlmFlowStateContext): DbxLlmFlowState {
  const { key, rawInput } = input;
  const section = state.sections[key];
  const config = context.sectionConfig(key);
  const mode = dbxLlmFlowSectionRawInputMode(config);
  let result = state;

  if (section != null && mode !== 'readonly' && !(input.typed && mode === 'one-way')) {
    const m = new DbxLlmFlowStateMutator(state, context);
    let change: Maybe<ApplyDraftInput>;

    if (mode === 'two-way' && dbxLlmFlowSectionRawInputFollowsForm(config)) {
      let parseError: Maybe<string>;
      let parsed: unknown;

      try {
        parsed = (config?.fromRawInput ?? defaultDbxLlmFlowFromRawInput)(rawInput);
        parseError = jsonIssueMessage(parsed);
      } catch (e) {
        parseError = `The input could not be parsed: ${(e as Error)?.message ?? e}`;
      }

      if (parseError == null) {
        change = { draft: { formValue: parsed, rawInput: input.typed ? rawInput : toRawInputForConfig(config, parsed), rawInputOverridden: false } };
      } else {
        change = { draft: { formValue: section.draft.formValue, rawInput, rawInputOverridden: true }, rawInputParseError: parseError };
      }
    } else {
      change = { draft: { formValue: section.draft.formValue, rawInput, rawInputOverridden: true } };
    }

    applyDraft(m, key, change);
    result = m.finish();
  }

  return result;
}

/**
 * Clears the raw input override and regenerates the raw input: from the form value when the raw input follows the form, otherwise (no form,
 * or a raw input source of "parent") from the output of the followed parent run. Such a section that follows no parent run only clears the
 * override.
 *
 * @param state - The state.
 * @param key - The section key.
 * @param context - The context.
 * @returns The new state.
 */
export function dbxLlmFlowStateWithRevertedRawInput(state: DbxLlmFlowState, key: DbxLlmFlowSectionKey, context: DbxLlmFlowStateContext): DbxLlmFlowState {
  const section = state.sections[key];
  let result = state;

  if (section?.draft.rawInputOverridden || section?.rawInputParseError) {
    const m = new DbxLlmFlowStateMutator(state, context);
    const config = m.config(key);
    const formValue = section.draft.formValue;
    let draft: DbxLlmFlowSectionInput;

    if (dbxLlmFlowSectionRawInputFollowsForm(config)) {
      draft = { formValue, rawInput: toRawInputForConfig(config, formValue), rawInputOverridden: false };
    } else {
      const parentRun = section.followedParentRunId == null ? undefined : m.run(section.followedParentRunId);
      const update = parentRun == null ? undefined : parentOutputDraftUpdate(config, parentRun, section.draft);
      draft = { ...section.draft, ...update, rawInputOverridden: false };
    }

    applyDraft(m, key, { draft });
    result = m.finish();
  }

  return result;
}

// MARK: Run Requests
export interface DbxLlmFlowRunRequestInput {
  readonly key: DbxLlmFlowSectionKey;
  readonly kind: DbxLlmFlowRunKind;
}

export interface DbxLlmFlowRunRequestResult {
  readonly state: DbxLlmFlowState;
  readonly requested: boolean;
}

/**
 * Requests a run of the kind. The matching run bridge consumes the request and triggers its action.
 *
 * @param state - The state.
 * @param input - The request.
 * @param context - The context.
 * @returns The new state, and false when no bridge for the kind is mounted.
 */
export function dbxLlmFlowStateWithRunRequest(state: DbxLlmFlowState, input: DbxLlmFlowRunRequestInput, context: DbxLlmFlowStateContext): DbxLlmFlowRunRequestResult {
  const section = state.sections[input.key];
  let result: DbxLlmFlowRunRequestResult = { state, requested: false };

  if (section != null && (section.runBridgeCounts?.[input.kind] ?? 0) > 0) {
    const request: DbxLlmFlowRunRequest = { id: context.nextRequestId(), kind: input.kind, draftRevision: section.draftRevision };
    result = { state: { ...state, runRequests: { ...state.runRequests, [input.key]: request } }, requested: true };
  }

  return result;
}

/**
 * Returns the section's pending run request for the kind, unless it went stale.
 *
 * @param state - The state.
 * @param key - The section key.
 * @param kind - The run kind.
 * @returns The pending request.
 */
export function dbxLlmFlowSectionRunRequest(state: DbxLlmFlowState, key: DbxLlmFlowSectionKey, kind: DbxLlmFlowRunKind): Maybe<DbxLlmFlowRunRequest> {
  const request = state.runRequests[key];
  return request?.kind === kind && request.draftRevision === state.sections[key]?.draftRevision ? request : undefined;
}

export interface DbxLlmFlowConsumeRunRequestInput {
  readonly key: DbxLlmFlowSectionKey;
  readonly requestId: DbxLlmFlowRunRequestId;
}

export interface DbxLlmFlowConsumeRunRequestResult {
  readonly state: DbxLlmFlowState;
  readonly consumed: boolean;
}

/**
 * Consumes a pending run request. Exactly one consumer succeeds; a stale request is dropped without being consumed.
 *
 * @param state - The state.
 * @param input - The request to consume.
 * @returns The new state, and whether it was consumed.
 */
export function dbxLlmFlowStateWithConsumedRunRequest(state: DbxLlmFlowState, input: DbxLlmFlowConsumeRunRequestInput): DbxLlmFlowConsumeRunRequestResult {
  const request = state.runRequests[input.key];
  let result: DbxLlmFlowConsumeRunRequestResult = { state, consumed: false };

  if (request?.id === input.requestId) {
    const runRequests = { ...state.runRequests };
    delete runRequests[input.key];
    result = { state: { ...state, runRequests }, consumed: request.draftRevision === state.sections[input.key]?.draftRevision };
  }

  return result;
}

export interface DbxLlmFlowRunBridgeInput {
  readonly key: DbxLlmFlowSectionKey;
  readonly kind: DbxLlmFlowRunKind;
  readonly mounted: boolean;
}

/**
 * Counts a mounted (or unmounted) run bridge for the section's kind.
 *
 * @param state - The state.
 * @param input - The bridge change.
 * @returns The new state.
 */
export function dbxLlmFlowStateWithRunBridge(state: DbxLlmFlowState, input: DbxLlmFlowRunBridgeInput): DbxLlmFlowState {
  const section = state.sections[input.key];
  let result = state;

  if (section != null) {
    const count = Math.max(0, (section.runBridgeCounts?.[input.kind] ?? 0) + (input.mounted ? 1 : -1));
    result = { ...state, sections: { ...state.sections, [input.key]: { ...section, runBridgeCounts: { ...section.runBridgeCounts, [input.kind]: count } } } };
  }

  return result;
}

// MARK: Import
export type DbxLlmFlowImportDuplicatesMode = 'skip' | 'replace';

export interface DbxLlmFlowImportRunsInput {
  readonly runs: readonly DbxLlmFlowRun[];
  /**
   * What to do with runs whose id already exists. Defaults to 'skip'. Active runs are never replaced.
   */
  readonly duplicates?: Maybe<DbxLlmFlowImportDuplicatesMode>;
  /**
   * Whether to select the latest successful imported run of each section.
   */
  readonly selectLatest?: Maybe<boolean>;
}

export interface DbxLlmFlowImportRunsSkippedRun {
  readonly id: DbxLlmFlowRunId;
  readonly reason: string;
}

export interface DbxLlmFlowImportRunsResult {
  readonly state: DbxLlmFlowState;
  readonly imported: readonly DbxLlmFlowRunId[];
  readonly skipped: readonly DbxLlmFlowImportRunsSkippedRun[];
}

/**
 * Imports runs (e.g. from a backend's history).
 *
 * - Non-JSON runs are skipped with a reason.
 * - 'running' runs are imported as interrupted failures.
 * - Orphans (unknown parent runs) are kept, and show under "other branches".
 *
 * @param state - The state.
 * @param input - The runs to import.
 * @param context - The context.
 * @returns The new state, plus the imported and skipped run ids.
 */
export function dbxLlmFlowStateWithImportedRuns(state: DbxLlmFlowState, input: DbxLlmFlowImportRunsInput, context: DbxLlmFlowStateContext): DbxLlmFlowImportRunsResult {
  const duplicates = input.duplicates ?? 'skip';
  const m = new DbxLlmFlowStateMutator(state, context);
  const imported: DbxLlmFlowRun[] = [];
  const skipped: DbxLlmFlowImportRunsSkippedRun[] = [];
  const activeRunIds = new Set(Object.values(state.sections).map((x) => x.activeRunId));

  for (const run of input.runs) {
    const existing = m.run(run.id);
    const jsonIssue = jsonIssueMessage(run.input.formValue) ?? jsonIssueMessage(run.output) ?? jsonIssueMessage(run.data);

    if (jsonIssue) {
      skipped.push({ id: run.id, reason: jsonIssue });
    } else if (existing != null && (duplicates === 'skip' || activeRunIds.has(run.id))) {
      skipped.push({ id: run.id, reason: activeRunIds.has(run.id) ? 'The run is active.' : 'A run with this id already exists.' });
    } else {
      const importedRun: DbxLlmFlowRun = run.state === 'running' ? { ...run, imported: true, state: 'failed', error: { code: DBX_LLM_FLOW_RUN_INTERRUPTED_ERROR_CODE, message: 'The run was interrupted.' } } : { ...run, imported: true };
      m.setRun(importedRun);
      imported.push(importedRun);
    }
  }

  if (input.selectLatest) {
    const latestPerSection = new Map<DbxLlmFlowSectionKey, DbxLlmFlowRun>();
    imported
      .filter((x) => x.state === 'success')
      .sort(compareRunsByStart)
      .forEach((x) => latestPerSection.set(x.sectionKey, x));

    // Parents first, so a child selection isn't replaced by its parent's cascade.
    const ordered = Array.from(latestPerSection.values()).sort((a, b) => dbxLlmFlowSectionAncestorKeys(m.state, a.sectionKey).length - dbxLlmFlowSectionAncestorKeys(m.state, b.sectionKey).length);
    ordered.forEach((run) => selectRun(m, run, 'restore', []));
  }

  return { state: m.finish(), imported: imported.map((x) => x.id), skipped };
}

// MARK: Restore
/**
 * Marks every 'running' run as an interrupted failure. Used when restoring persisted state.
 *
 * @param runs - The runs.
 * @param now - The time to stamp as finishedAt.
 * @returns The runs.
 */
export function dbxLlmFlowRunsWithInterruptedRuns(runs: Readonly<Record<DbxLlmFlowRunId, DbxLlmFlowRun>>, now: Date): Record<DbxLlmFlowRunId, DbxLlmFlowRun> {
  const result: Record<DbxLlmFlowRunId, DbxLlmFlowRun> = {};

  for (const [id, run] of Object.entries(runs)) {
    result[id] = run.state === 'running' ? { ...run, state: 'failed', finishedAt: now, error: { code: DBX_LLM_FLOW_RUN_INTERRUPTED_ERROR_CODE, message: 'The run was interrupted.' } } : run;
  }

  return result;
}
