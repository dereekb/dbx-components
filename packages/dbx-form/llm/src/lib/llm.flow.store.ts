import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { type DestroyFunction, type Maybe, type ModelIdFactory } from '@dereekb/util';
import { BehaviorSubject, distinctUntilChanged, map, type Observable, shareReplay, combineLatest } from 'rxjs';
import {
  type DbxLlmFlowAnySectionConfig,
  type DbxLlmFlowConfig,
  type DbxLlmFlowFormBindingId,
  type DbxLlmFlowRun,
  type DbxLlmFlowRunAvailability,
  type DbxLlmFlowRunBlockedReason,
  type DbxLlmFlowRunError,
  type DbxLlmFlowRunId,
  type DbxLlmFlowRunKind,
  type DbxLlmFlowRunRequest,
  type DbxLlmFlowRunRequestId,
  type DbxLlmFlowRunValue,
  type DbxLlmFlowSectionFormBinding,
  type DbxLlmFlowSectionInput,
  type DbxLlmFlowSectionKey,
  type DbxLlmFlowSectionState,
  type DbxLlmFlowState,
  dbxLlmFlowRunIdFactory
} from './llm.flow';
import {
  type DbxLlmFlowImportRunsInput,
  type DbxLlmFlowImportRunsSkippedRun,
  type DbxLlmFlowLoadRunInput,
  type DbxLlmFlowStateContext,
  dbxLlmFlowSectionRunAvailability,
  dbxLlmFlowSectionRunRequest,
  dbxLlmFlowSectionRuns,
  dbxLlmFlowStateWithCancelledRun,
  dbxLlmFlowStateWithCompletedRun,
  dbxLlmFlowStateWithConsumedRunRequest,
  dbxLlmFlowStateWithDraft,
  dbxLlmFlowStateWithDraftFormValue,
  dbxLlmFlowStateWithFailedRun,
  dbxLlmFlowStateWithFormValid,
  dbxLlmFlowStateWithImportedRuns,
  dbxLlmFlowStateWithLoadedRun,
  dbxLlmFlowStateWithPastedRawInput,
  dbxLlmFlowStateWithRegisteredSection,
  dbxLlmFlowStateWithRevertedRawInput,
  dbxLlmFlowStateWithRunBridge,
  dbxLlmFlowStateWithRunRequest,
  dbxLlmFlowStateWithStartedRun,
  dbxLlmFlowStateWithUnregisteredSection,
  initialDbxLlmFlowState
} from './llm.flow.state';
import { type DbxLlmFlowPersistedState, dbxLlmFlowStateWithReset, dbxLlmFlowStateWithRestoredPersistedState } from './llm.flow.storage';

/**
 * Input for DbxLlmFlowStore.registerSection().
 */
export interface DbxLlmFlowStoreRegisterSectionInput {
  readonly key: DbxLlmFlowSectionKey;
  readonly parentKey?: Maybe<DbxLlmFlowSectionKey>;
  readonly config?: Maybe<DbxLlmFlowAnySectionConfig>;
}

/**
 * Result of DbxLlmFlowStore.startRun(). Has either the value to hand to the run handler, or the reason the run was blocked.
 */
export interface DbxLlmFlowStoreStartRunResult<F = unknown, O = unknown> {
  readonly value?: Maybe<DbxLlmFlowRunValue<F, O>>;
  readonly blockedReason?: Maybe<DbxLlmFlowRunBlockedReason>;
}

/**
 * Result of DbxLlmFlowStore.importRuns().
 */
export interface DbxLlmFlowStoreImportRunsResult {
  readonly imported: readonly DbxLlmFlowRunId[];
  readonly skipped: readonly DbxLlmFlowImportRunsSkippedRun[];
}

interface DbxLlmFlowStoreUpdateResult {
  readonly state: DbxLlmFlowState;
}

/**
 * Holds the state of a whole LLM flow: every section's draft and selection, every run, run requests and restore state.
 *
 * All logic lives in the pure transitions of llm.flow.state.ts. Section configs (functions, components, handlers) are kept in a config map that is never persisted.
 *
 * Every update goes through one synchronous path that tracks the latest state, so methods that answer synchronously (startRun(), requestRun(), consumeRunRequest()) always answer against the newest state, even while ComponentStore defers its own updates on the queue scheduler.
 */
@Injectable()
export class DbxLlmFlowStore extends ComponentStore<DbxLlmFlowState> {
  private readonly _flowConfig = new BehaviorSubject<Maybe<DbxLlmFlowConfig>>(undefined);
  private readonly _sectionConfigs = new BehaviorSubject<Readonly<Record<DbxLlmFlowSectionKey, DbxLlmFlowAnySectionConfig>>>({});

  private _latestState: DbxLlmFlowState = initialDbxLlmFlowState();
  private _nextRequestId: DbxLlmFlowRunRequestId = 0;
  private _nextBindingId: DbxLlmFlowFormBindingId = 0;
  private _defaultRunIdFactory: Maybe<ModelIdFactory>;

  readonly flowConfig$: Observable<Maybe<DbxLlmFlowConfig>> = this._flowConfig.asObservable();
  readonly sectionConfigs$: Observable<Readonly<Record<DbxLlmFlowSectionKey, DbxLlmFlowAnySectionConfig>>> = this._sectionConfigs.asObservable();

  readonly sections$ = this.select((x) => x.sections);
  readonly runs$ = this.select((x) => x.runs);
  readonly restoring$ = this.select((x) => x.restoring);
  readonly storageKey$ = this.select((x) => x.storageKey);
  readonly anyRunning$ = this.select((x) => Object.values(x.sections).some((y) => y.activeRunId != null));

  constructor() {
    super(initialDbxLlmFlowState());
  }

  // MARK: Config
  get flowConfig(): Maybe<DbxLlmFlowConfig> {
    return this._flowConfig.value;
  }

  /**
   * Sets the flow config. Configs of the flow's sections are added to the config map.
   *
   * @param config - The flow config.
   */
  setFlowConfig(config: Maybe<DbxLlmFlowConfig>): void {
    this._flowConfig.next(config);

    if (config?.sections?.length) {
      const configs = { ...this._sectionConfigs.value };
      config.sections.forEach((x) => (configs[x.key] = x));
      this._sectionConfigs.next(configs);
    }
  }

  sectionConfig(key: DbxLlmFlowSectionKey): Maybe<DbxLlmFlowAnySectionConfig> {
    return this._sectionConfigs.value[key];
  }

  sectionConfig$(key: DbxLlmFlowSectionKey): Observable<Maybe<DbxLlmFlowAnySectionConfig>> {
    return this._sectionConfigs.pipe(
      map((x) => x[key]),
      distinctUntilChanged()
    );
  }

  /**
   * Returns the latest state, including updates ComponentStore has not applied yet.
   *
   * @returns The latest state.
   */
  currentState(): DbxLlmFlowState {
    return this._latestState;
  }

  /**
   * Creates the context the transitions need.
   *
   * @returns A new context.
   */
  makeContext(): DbxLlmFlowStateContext {
    const configs = this._sectionConfigs.value;

    return {
      now: new Date(),
      flowConfig: this._flowConfig.value,
      sectionConfig: (key) => configs[key],
      nextRequestId: () => (this._nextRequestId += 1)
    };
  }

  // MARK: Selectors
  section$(key: DbxLlmFlowSectionKey): Observable<Maybe<DbxLlmFlowSectionState>> {
    return this.select((x) => x.sections[key]);
  }

  run$(runId: Maybe<DbxLlmFlowRunId>): Observable<Maybe<DbxLlmFlowRun>> {
    return this.select((x) => (runId == null ? undefined : x.runs[runId]));
  }

  /**
   * Returns the section's runs, oldest first.
   *
   * @param key - The section key.
   * @returns Observable of the runs.
   */
  runsForSection$(key: DbxLlmFlowSectionKey): Observable<DbxLlmFlowRun[]> {
    return this.runs$.pipe(
      map((runs) => dbxLlmFlowSectionRuns({ runs }, key)),
      distinctUntilChanged((a, b) => a.length === b.length && a.every((x, i) => x === b[i])),
      shareReplay(1)
    );
  }

  runAvailability$(key: DbxLlmFlowSectionKey): Observable<DbxLlmFlowRunAvailability> {
    return combineLatest([this.state$, this._flowConfig, this._sectionConfigs]).pipe(
      map(([state, flowConfig, configs]) => dbxLlmFlowSectionRunAvailability(state, key, { flowConfig, sectionConfig: (x) => configs[x] })),
      distinctUntilChanged((a, b) => a.canRun === b.canRun && a.blockedReason === b.blockedReason),
      shareReplay(1)
    );
  }

  runRequest$(key: DbxLlmFlowSectionKey, kind: DbxLlmFlowRunKind): Observable<Maybe<DbxLlmFlowRunRequest>> {
    return this.select((x) => dbxLlmFlowSectionRunRequest(x, key, kind));
  }

  // MARK: Update
  private _update<R extends DbxLlmFlowStoreUpdateResult>(fn: (state: DbxLlmFlowState) => R): R {
    const result = fn(this._latestState);

    if (result.state !== this._latestState) {
      this._latestState = result.state;
      this.setState(result.state);
    }

    return result;
  }

  private _updateState(fn: (state: DbxLlmFlowState) => DbxLlmFlowState): void {
    this._update((state) => ({ state: fn(state) }));
  }

  // MARK: Sections
  /**
   * Registers (mounts) a section and its config. The section's state outlives unmounting.
   *
   * @param input - The section to register.
   * @returns Unregisters the section when called.
   */
  registerSection(input: DbxLlmFlowStoreRegisterSectionInput): DestroyFunction {
    const { key, parentKey, config } = input;

    if (config != null && this._sectionConfigs.value[key] !== config) {
      this._sectionConfigs.next({ ...this._sectionConfigs.value, [key]: config });
    }

    this._updateState((state) => dbxLlmFlowStateWithRegisteredSection(state, { key, parentKey }, this.makeContext()));

    let destroyed = false;

    return () => {
      if (!destroyed) {
        destroyed = true;
        this._updateState((state) => dbxLlmFlowStateWithUnregisteredSection(state, key));
      }
    };
  }

  // MARK: Runs
  private _nextRunId(state: DbxLlmFlowState): DbxLlmFlowRunId {
    const factory = this._flowConfig.value?.runIdFactory ?? (this._defaultRunIdFactory ??= dbxLlmFlowRunIdFactory());
    let id = factory();

    while (state.runs[id] != null) {
      id = factory();
    }

    return id;
  }

  /**
   * Starts a run of the section with its current draft.
   *
   * @param key - The section key.
   * @param kind - The run kind.
   * @returns The run value, or the reason the run was blocked.
   */
  startRun<F = unknown, O = unknown>(key: DbxLlmFlowSectionKey, kind: DbxLlmFlowRunKind): DbxLlmFlowStoreStartRunResult<F, O> {
    const result = this._update((state) => dbxLlmFlowStateWithStartedRun(state, { sectionKey: key, kind, runId: this._nextRunId(state) }, this.makeContext()));
    return { value: result.value as Maybe<DbxLlmFlowRunValue<F, O>>, blockedReason: result.blockedReason };
  }

  completeRun(runId: DbxLlmFlowRunId, output?: unknown, data?: unknown): void {
    this._updateState((state) => dbxLlmFlowStateWithCompletedRun(state, { runId, output, data }, this.makeContext()));
  }

  failRun(runId: DbxLlmFlowRunId, error?: Maybe<DbxLlmFlowRunError>): void {
    this._updateState((state) => dbxLlmFlowStateWithFailedRun(state, { runId, error }, this.makeContext()));
  }

  cancelRun(runId: DbxLlmFlowRunId): void {
    this._updateState((state) => dbxLlmFlowStateWithCancelledRun(state, runId, this.makeContext()));
  }

  /**
   * Loads a run from history.
   *
   * @param input - The run to load.
   * @returns Whether the run was loaded.
   */
  loadRun(input: DbxLlmFlowLoadRunInput): boolean {
    return this._update((state) => dbxLlmFlowStateWithLoadedRun(state, input, this.makeContext())).loaded;
  }

  // MARK: Draft
  loadDraft(key: DbxLlmFlowSectionKey, input: Partial<DbxLlmFlowSectionInput>): void {
    this._updateState((state) => dbxLlmFlowStateWithDraft(state, { key, input }, this.makeContext()));
  }

  /**
   * Registers a form binding. Binding ids are unique within the flow.
   *
   * @returns The binding. Destroying it has no effect on the state.
   */
  registerFormBinding(): DbxLlmFlowSectionFormBinding {
    const id = (this._nextBindingId += 1);
    return { id, destroy: () => undefined };
  }

  setDraftFormValue(key: DbxLlmFlowSectionKey, bindingId: DbxLlmFlowFormBindingId, formValue: unknown): void {
    this._updateState((state) => dbxLlmFlowStateWithDraftFormValue(state, { key, bindingId, formValue }, this.makeContext()));
  }

  setFormValid(key: DbxLlmFlowSectionKey, valid: Maybe<boolean>): void {
    this._updateState((state) => dbxLlmFlowStateWithFormValid(state, { key, valid }));
  }

  /**
   * Pastes text over the raw input.
   *
   * @param key - The section key.
   * @param rawInput - The pasted text.
   */
  pasteRawInput(key: DbxLlmFlowSectionKey, rawInput: string): void {
    this._updateState((state) => dbxLlmFlowStateWithPastedRawInput(state, { key, rawInput }, this.makeContext()));
  }

  /**
   * Sets typed raw input text. Typed text is never parsed back into the form.
   *
   * @param key - The section key.
   * @param rawInput - The typed text.
   */
  setRawInput(key: DbxLlmFlowSectionKey, rawInput: string): void {
    this._updateState((state) => dbxLlmFlowStateWithPastedRawInput(state, { key, rawInput, typed: true }, this.makeContext()));
  }

  revertRawInputToForm(key: DbxLlmFlowSectionKey): void {
    this._updateState((state) => dbxLlmFlowStateWithRevertedRawInput(state, key, this.makeContext()));
  }

  // MARK: Run Requests
  /**
   * Requests a run of the section's kind. The kind's run bridge triggers its action.
   *
   * @param key - The section key.
   * @param kind - The run kind.
   * @returns False when no run bridge for the kind is mounted.
   */
  requestRun(key: DbxLlmFlowSectionKey, kind: DbxLlmFlowRunKind): boolean {
    return this._update((state) => dbxLlmFlowStateWithRunRequest(state, { key, kind }, this.makeContext())).requested;
  }

  /**
   * Restores the run's input as the draft and requests a new run of the same kind.
   *
   * @param runId - The run to repeat.
   * @returns Whether the run was requested.
   */
  rerun(runId: DbxLlmFlowRunId): boolean {
    return this._update((state) => {
      const run = state.runs[runId];
      let result: { state: DbxLlmFlowState; requested: boolean } = { state, requested: false };

      if (run != null) {
        const context = this.makeContext();
        const withDraft = dbxLlmFlowStateWithDraft(state, { key: run.sectionKey, input: run.input }, context);
        const requestResult = dbxLlmFlowStateWithRunRequest(withDraft, { key: run.sectionKey, kind: run.kind }, context);
        result = requestResult.requested ? requestResult : result;
      }

      return result;
    }).requested;
  }

  /**
   * Consumes a run request. Exactly one caller consumes a request.
   *
   * @param key - The section key.
   * @param requestId - The request id.
   * @returns Whether the request was consumed and is still current.
   */
  consumeRunRequest(key: DbxLlmFlowSectionKey, requestId: DbxLlmFlowRunRequestId): boolean {
    return this._update((state) => dbxLlmFlowStateWithConsumedRunRequest(state, { key, requestId })).consumed;
  }

  /**
   * Registers a mounted run bridge for the kind.
   *
   * @param key - The section key.
   * @param kind - The run kind.
   * @returns Unregisters the bridge when called.
   */
  registerRunBridge(key: DbxLlmFlowSectionKey, kind: DbxLlmFlowRunKind): DestroyFunction {
    this._updateState((state) => dbxLlmFlowStateWithRunBridge(state, { key, kind, mounted: true }));
    let destroyed = false;

    return () => {
      if (!destroyed) {
        destroyed = true;
        this._updateState((state) => dbxLlmFlowStateWithRunBridge(state, { key, kind, mounted: false }));
      }
    };
  }

  // MARK: Import
  importRuns(input: DbxLlmFlowImportRunsInput): DbxLlmFlowStoreImportRunsResult {
    const { imported, skipped } = this._update((state) => dbxLlmFlowStateWithImportedRuns(state, input, this.makeContext()));
    return { imported, skipped };
  }

  // MARK: Reset/Restore
  /**
   * Resets every section to its initial draft and drops every run. Mounted sections stay mounted.
   */
  resetFlow(): void {
    this._updateState((state) => dbxLlmFlowStateWithReset(state, { storageKey: state.storageKey, restoring: false }, this.makeContext()));
  }

  /**
   * Resets the flow for a new storage key and blocks runs until restorePersistedState() is called.
   *
   * @param storageKey - The new storage key.
   */
  beginRestore(storageKey: Maybe<string>): void {
    this._updateState((state) => dbxLlmFlowStateWithReset(state, { storageKey, restoring: true }, this.makeContext()));
  }

  /**
   * Restores the persisted state and ends restoring.
   *
   * @param persisted - The persisted state. Undefined restores a blank state.
   */
  restorePersistedState(persisted: Maybe<DbxLlmFlowPersistedState>): void {
    this._updateState((state) => dbxLlmFlowStateWithRestoredPersistedState(state, persisted, this.makeContext()));
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._flowConfig.complete();
    this._sectionConfigs.complete();
  }
}
