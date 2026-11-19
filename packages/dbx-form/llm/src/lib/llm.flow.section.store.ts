import { inject, Injectable, type OnDestroy, signal } from '@angular/core';
import { type DestroyFunction, type Maybe } from '@dereekb/util';
import { filterMaybe } from '@dereekb/rxjs';
import { BehaviorSubject, combineLatest, distinctUntilChanged, filter, map, type Observable, of, shareReplay, switchMap } from 'rxjs';
import {
  type DbxLlmFlowAnySectionConfig,
  type DbxLlmFlowFormBindingId,
  type DbxLlmFlowRawInputMode,
  type DbxLlmFlowRun,
  type DbxLlmFlowRunAvailability,
  type DbxLlmFlowRunDescription,
  type DbxLlmFlowRunError,
  type DbxLlmFlowRunId,
  type DbxLlmFlowRunKind,
  type DbxLlmFlowRunRequest,
  type DbxLlmFlowRunRequestId,
  type DbxLlmFlowSectionFormBinding,
  DbxLlmFlowSectionFormBindingTarget,
  type DbxLlmFlowSectionFormPopoutMode,
  type DbxLlmFlowSectionInput,
  type DbxLlmFlowSectionInputSource,
  type DbxLlmFlowSectionKey,
  type DbxLlmFlowSectionState
} from './llm.flow';
import { dbxLlmFlowSectionInputSource, dbxLlmFlowSectionOptionsDescription, dbxLlmFlowSectionRawInputFollowsForm, dbxLlmFlowSectionRawInputMode, dbxLlmFlowSectionSelectedRuns, dbxLlmFlowSectionStepNumber } from './llm.flow.state';
import { DbxLlmFlowStore, type DbxLlmFlowStoreStartRunResult } from './llm.flow.store';

/**
 * Overall status of a section, for display.
 */
export type DbxLlmFlowSectionStatus = 'idle' | 'running' | 'success' | 'failed';

/**
 * A section's history, newest first, split into the runs made under the currently followed parent run and the rest.
 */
export interface DbxLlmFlowSectionHistoryGroups {
  readonly current: readonly DbxLlmFlowRun[];
  readonly other: readonly DbxLlmFlowRun[];
}

/**
 * Input for DbxLlmFlowSectionStore.register().
 */
export interface DbxLlmFlowSectionStoreRegisterInput {
  readonly config: DbxLlmFlowAnySectionConfig;
  /**
   * Explicit parent key. Defaults to the config's parentKey, then the nearest ancestor section.
   */
  readonly parentKey?: Maybe<DbxLlmFlowSectionKey>;
}

/**
 * The state and actions of one section. Injects the flow store, exposes the section's slice, and implements the form binding contract.
 *
 * Provided by DbxLlmFlowSectionDirective.
 */
@Injectable()
export class DbxLlmFlowSectionStore<F = unknown, O = unknown> extends DbxLlmFlowSectionFormBindingTarget<F> implements OnDestroy {
  readonly flowStore = inject(DbxLlmFlowStore);
  readonly parentSectionStore = inject(DbxLlmFlowSectionStore, { skipSelf: true, optional: true });

  private readonly _key = new BehaviorSubject<Maybe<DbxLlmFlowSectionKey>>(undefined);
  private readonly _formValidity = new Map<DbxLlmFlowFormBindingId, boolean>();

  /**
   * Whether the inline form is shown.
   */
  readonly formVisible = signal(true);

  /**
   * The open form pop-out, if any.
   */
  readonly popout = signal<Maybe<DbxLlmFlowSectionFormPopoutMode>>(undefined);

  readonly key$: Observable<DbxLlmFlowSectionKey> = this._key.pipe(filterMaybe(), distinctUntilChanged(), shareReplay(1));

  readonly config$: Observable<Maybe<DbxLlmFlowAnySectionConfig>> = this.key$.pipe(
    switchMap((key) => this.flowStore.sectionConfig$(key)),
    shareReplay(1)
  );

  readonly section$: Observable<Maybe<DbxLlmFlowSectionState<F>>> = this.key$.pipe(
    switchMap((key) => this.flowStore.section$(key) as Observable<Maybe<DbxLlmFlowSectionState<F>>>),
    shareReplay(1)
  );

  /**
   * Whether the section is collapsed to its header. Kept in the flow state, so it is persisted with the flow.
   */
  readonly collapsed$: Observable<boolean> = this.section$.pipe(
    map((x) => x?.collapsed === true),
    distinctUntilChanged()
  );

  readonly draft$: Observable<Maybe<DbxLlmFlowSectionInput<F>>> = this.section$.pipe(
    map((x) => x?.draft),
    distinctUntilChanged()
  );

  /**
   * The draft's form value. For a view-only section, its state. See DbxLlmFlowSectionConfig.viewOnly.
   */
  readonly formValue$: Observable<Maybe<F>> = this.draft$.pipe(
    map((x) => x?.formValue),
    distinctUntilChanged()
  );

  readonly rawInput$: Observable<string> = this.draft$.pipe(
    map((x) => x?.rawInput ?? ''),
    distinctUntilChanged()
  );

  readonly rawInputOverridden$: Observable<boolean> = this.draft$.pipe(
    map((x) => Boolean(x?.rawInputOverridden)),
    distinctUntilChanged()
  );

  /**
   * Where the raw input comes from: the form, the parent's output, or manual input.
   */
  readonly inputSource$: Observable<DbxLlmFlowSectionInputSource> = combineLatest([this.section$, this.config$]).pipe(
    map(([section, config]) => dbxLlmFlowSectionInputSource(section, config)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Whether the section follows a parent run.
   */
  readonly followsParentRun$: Observable<boolean> = this.section$.pipe(
    map((x) => x?.followedParentRunId != null),
    distinctUntilChanged()
  );

  /**
   * The parent section's config, if the section has a registered parent.
   */
  readonly parentConfig$: Observable<Maybe<DbxLlmFlowAnySectionConfig>> = this.section$.pipe(
    map((x) => x?.parentKey),
    distinctUntilChanged(),
    switchMap((parentKey) => (parentKey == null ? of(undefined) : this.flowStore.sectionConfig$(parentKey))),
    shareReplay(1)
  );

  /**
   * The section's step number in its chain: 1 for a root section, plus one per registered ancestor, re-based by the nearest fixed stepNumber
   * in the chain.
   */
  readonly stepNumber$: Observable<number> = combineLatest([this.key$, this.flowStore.sections$, this.flowStore.sectionConfigs$]).pipe(
    map(([key, sections, configs]) => dbxLlmFlowSectionStepNumber({ sections }, key, { sectionConfig: (x) => configs[x] })),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly rawInputMode$: Observable<DbxLlmFlowRawInputMode> = this.config$.pipe(map(dbxLlmFlowSectionRawInputMode), distinctUntilChanged());

  readonly inputIssues$: Observable<readonly string[]> = this.section$.pipe(
    map((x) => x?.inputIssues ?? []),
    distinctUntilChanged()
  );

  readonly formHidden$: Observable<boolean> = combineLatest([this.rawInputOverridden$, this.config$]).pipe(
    map(([overridden, config]) => overridden && config?.rawInput?.oneWayFormMode === 'hide' && dbxLlmFlowSectionRawInputFollowsForm(config)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Whether bound forms are locked: while restoring, while the section runs, or while the raw input is overridden and follows the form.
   */
  readonly formLocked$: Observable<boolean> = combineLatest([this.section$, this.config$, this.flowStore.restoring$]).pipe(
    map(([section, config, restoring]) => restoring || section?.activeRunId != null || (Boolean(section?.draft.rawInputOverridden) && dbxLlmFlowSectionRawInputFollowsForm(config))),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly runs$: Observable<DbxLlmFlowRun<F, O>[]> = this.key$.pipe(
    switchMap((key) => this.flowStore.runsForSection$(key) as Observable<DbxLlmFlowRun<F, O>[]>),
    shareReplay(1)
  );

  readonly selectedRuns$: Observable<DbxLlmFlowRun<F, O>[]> = this.key$.pipe(
    switchMap((key) => this.flowStore.select((state) => dbxLlmFlowSectionSelectedRuns(state, key) as DbxLlmFlowRun<F, O>[], { equal: (a: DbxLlmFlowRun<F, O>[], b: DbxLlmFlowRun<F, O>[]) => a.length === b.length && a.every((x, i) => x === b[i]) })),
    shareReplay(1)
  );

  /**
   * The primary selected run.
   */
  readonly selectedRun$: Observable<Maybe<DbxLlmFlowRun<F, O>>> = this.selectedRuns$.pipe(
    map((x) => x[x.length - 1]),
    distinctUntilChanged()
  );

  readonly selectedOutput$: Observable<Maybe<O>> = this.selectedRun$.pipe(
    map((x) => x?.output),
    distinctUntilChanged()
  );

  readonly activeRun$: Observable<Maybe<DbxLlmFlowRun<F, O>>> = this._sectionRun$((x) => x?.activeRunId);
  readonly lastFailedRun$: Observable<Maybe<DbxLlmFlowRun<F, O>>> = this._sectionRun$((x) => x?.lastFailedRunId);

  readonly isRunning$: Observable<boolean> = this.section$.pipe(
    map((x) => x?.activeRunId != null),
    distinctUntilChanged()
  );

  readonly historyGroups$: Observable<DbxLlmFlowSectionHistoryGroups> = combineLatest([this.section$, this.runs$]).pipe(
    map(([section, runs]) => {
      const followed = section?.followedParentRunId ?? undefined;
      const newestFirst = [...runs].reverse();
      return { current: newestFirst.filter((x) => (x.parentRunId ?? undefined) === followed), other: newestFirst.filter((x) => (x.parentRunId ?? undefined) !== followed) };
    }),
    shareReplay(1)
  );

  /**
   * Whether the primary selected run was made under a different parent run than the one the section follows.
   */
  readonly isSelectedRunOffBranch$: Observable<boolean> = combineLatest([this.section$, this.selectedRun$]).pipe(
    map(([section, run]) => run != null && (run.parentRunId ?? undefined) !== (section?.followedParentRunId ?? undefined)),
    distinctUntilChanged()
  );

  readonly runAvailability$: Observable<DbxLlmFlowRunAvailability> = this.key$.pipe(
    switchMap((key) => this.flowStore.runAvailability$(key)),
    shareReplay(1)
  );

  readonly canRun$: Observable<boolean> = this.runAvailability$.pipe(
    map((x) => x.canRun),
    distinctUntilChanged()
  );

  readonly status$: Observable<DbxLlmFlowSectionStatus> = combineLatest([this.section$, this.selectedRun$, this.lastFailedRun$]).pipe(
    map(([section, selected, failed]) => {
      let status: DbxLlmFlowSectionStatus = 'idle';

      if (section?.activeRunId != null) {
        status = 'running';
      } else if (failed != null && (selected == null || failed.startedAt.getTime() > selected.startedAt.getTime())) {
        status = 'failed';
      } else if (selected != null) {
        status = 'success';
      }

      return status;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  private _sectionRun$(readId: (section: Maybe<DbxLlmFlowSectionState<F>>) => Maybe<DbxLlmFlowRunId>): Observable<Maybe<DbxLlmFlowRun<F, O>>> {
    return this.section$.pipe(
      map(readId),
      distinctUntilChanged(),
      switchMap((id) => this.flowStore.run$(id) as Observable<Maybe<DbxLlmFlowRun<F, O>>>),
      shareReplay(1)
    );
  }

  // MARK: Key
  get key(): DbxLlmFlowSectionKey {
    const key = this._key.value;

    if (key == null) {
      throw new Error('DbxLlmFlowSectionStore: the section has not been registered yet.');
    }

    return key;
  }

  get keyValue(): Maybe<DbxLlmFlowSectionKey> {
    return this._key.value;
  }

  get config(): Maybe<DbxLlmFlowAnySectionConfig> {
    const key = this._key.value;
    return key == null ? undefined : this.flowStore.sectionConfig(key);
  }

  get section(): Maybe<DbxLlmFlowSectionState<F>> {
    const key = this._key.value;
    return key == null ? undefined : (this.flowStore.currentState().sections[key] as Maybe<DbxLlmFlowSectionState<F>>);
  }

  /**
   * Registers the section with the flow store.
   *
   * @param input - The config and optional parent key.
   * @returns Unregisters the section when called.
   */
  register(input: DbxLlmFlowSectionStoreRegisterInput): DestroyFunction {
    const { config } = input;
    const parentKey = input.parentKey ?? config.parentKey ?? this.parentSectionStore?.keyValue;
    this._key.next(config.key);
    return this.flowStore.registerSection({ key: config.key, parentKey, config });
  }

  // MARK: Selectors
  selectedRunForKind$(kind: DbxLlmFlowRunKind): Observable<Maybe<DbxLlmFlowRun<F, O>>> {
    return this.selectedRuns$.pipe(
      map((x) => x.find((y) => y.kind === kind)),
      distinctUntilChanged()
    );
  }

  runRequestForKind$(kind: DbxLlmFlowRunKind): Observable<Maybe<DbxLlmFlowRunRequest>> {
    return this.key$.pipe(switchMap((key) => this.flowStore.runRequest$(key, kind)));
  }

  // MARK: Runs
  startRun(kind: DbxLlmFlowRunKind): DbxLlmFlowStoreStartRunResult<F, O> {
    return this.flowStore.startRun<F, O>(this.key, kind);
  }

  completeRun(runId: DbxLlmFlowRunId, output?: Maybe<O>, data?: unknown): void {
    this.flowStore.completeRun(runId, output, data);
  }

  failRun(runId: DbxLlmFlowRunId, error?: Maybe<DbxLlmFlowRunError>): void {
    this.flowStore.failRun(runId, error);
  }

  cancelRun(runId: DbxLlmFlowRunId): void {
    this.flowStore.cancelRun(runId);
  }

  /**
   * Loads a run from history and cascades to the descendants.
   *
   * @param runId - The run to load.
   * @param withAncestors - Whether to also load the run's ancestors.
   * @returns Whether the run was loaded.
   */
  loadRun(runId: DbxLlmFlowRunId, withAncestors?: Maybe<boolean>): boolean {
    return this.flowStore.loadRun({ runId, withAncestors });
  }

  /**
   * Restores the run's input and requests a new run of the same kind.
   *
   * @param runId - The run to repeat.
   * @returns Whether the run was requested.
   */
  rerun(runId: DbxLlmFlowRunId): boolean {
    return this.flowStore.rerun(runId);
  }

  requestRun(kind: DbxLlmFlowRunKind): boolean {
    return this.flowStore.requestRun(this.key, kind);
  }

  consumeRunRequest(requestId: DbxLlmFlowRunRequestId): boolean {
    return this.flowStore.consumeRunRequest(this.key, requestId);
  }

  registerRunBridge(kind: DbxLlmFlowRunKind): DestroyFunction {
    return this.flowStore.registerRunBridge(this.key, kind);
  }

  /**
   * Describes a run for history rows, using the section's describeRun(), then the flow's, then a default. Without a detail, the detail lists
   * the run's options when the section has option fields.
   *
   * @param run - The run.
   * @returns The description.
   */
  describeRun(run: DbxLlmFlowRun): DbxLlmFlowRunDescription {
    const config = this.config;
    const describe = config?.describeRun ?? this.flowStore.flowConfig?.describeRun;
    const description = describe?.(run) ?? { title: run.id };
    const optionsDetail = description.detail ? undefined : dbxLlmFlowSectionOptionsDescription(config?.optionFields, run.input.formValue);
    return optionsDetail ? { ...description, detail: optionsDetail } : description;
  }

  // MARK: Draft
  loadDraft(input: Partial<DbxLlmFlowSectionInput<F>>): void {
    this.flowStore.loadDraft(this.key, input);
  }

  /**
   * Sets the form value from the store, such as a view-only section's state, and seeds the bound forms. A value deep-equal to the current one is
   * ignored. See DbxLlmFlowStore.setFormValue().
   *
   * @param formValue - The form value. Must be JSON-compatible.
   */
  setFormValue(formValue: Maybe<F>): void {
    this.flowStore.setFormValue(this.key, formValue);
  }

  pasteRawInput(rawInput: string): void {
    this.flowStore.pasteRawInput(this.key, rawInput);
  }

  setRawInput(rawInput: string): void {
    this.flowStore.setRawInput(this.key, rawInput);
  }

  /**
   * Clears the raw input override and regenerates the raw input from the form value, or from the followed parent run's output for a section
   * without a form.
   */
  revertRawInput(): void {
    this.flowStore.revertRawInput(this.key);
  }

  // MARK: Form Binding
  override registerFormBinding(): DbxLlmFlowSectionFormBinding {
    const binding = this.flowStore.registerFormBinding();

    return {
      id: binding.id,
      destroy: () => {
        binding.destroy();

        if (this._formValidity.delete(binding.id)) {
          this._updateFormValid();
        }
      }
    };
  }

  override formSeed$(id: DbxLlmFlowFormBindingId): Observable<Maybe<F>> {
    return this.section$.pipe(
      filterMaybe(),
      distinctUntilChanged((a, b) => a.key === b.key && a.draftRevision === b.draftRevision),
      filter((x) => x.draftSource !== id),
      map((x) => x.draft.formValue)
    );
  }

  override setDraftFormValue(id: DbxLlmFlowFormBindingId, value: Maybe<F>): void {
    this.flowStore.setDraftFormValue(this.key, id, value);
  }

  override setFormValid(id: DbxLlmFlowFormBindingId, valid: boolean): void {
    if (this._formValidity.get(id) !== valid) {
      this._formValidity.set(id, valid);
      this._updateFormValid();
    }
  }

  private _updateFormValid(): void {
    const key = this._key.value;

    if (key != null) {
      const values = Array.from(this._formValidity.values());
      this.flowStore.setFormValid(key, values.length ? values.every(Boolean) : undefined);
    }
  }

  // MARK: UI
  setFormVisible(visible: boolean): void {
    this.formVisible.set(visible);
  }

  toggleFormVisible(): void {
    this.formVisible.update((x) => !x);
  }

  setCollapsed(collapsed: boolean): void {
    this.flowStore.setCollapsed(this.key, collapsed);
  }

  toggleCollapsed(): void {
    this.setCollapsed(this.section?.collapsed !== true);
  }

  /**
   * Opens the form pop-out. The section component reacts by opening a dialog or a detached window.
   *
   * @param mode - The pop-out mode. Defaults to the config's mode, then 'dialog'.
   */
  openFormPopout(mode?: Maybe<DbxLlmFlowSectionFormPopoutMode>): void {
    const popout = this.config?.formPopout;
    this.popout.set(mode ?? (popout ? popout.mode : undefined) ?? 'dialog');
  }

  closeFormPopout(): void {
    this.popout.set(undefined);
  }

  ngOnDestroy(): void {
    this._key.complete();
  }
}
