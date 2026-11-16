import { type LimitedStorageAccessor } from '@dereekb/dbx-core';
import { type Destroyable, type Maybe, type Milliseconds, type UnixDateTimeMillisecondsNumber } from '@dereekb/util';
import { SubscriptionObject } from '@dereekb/rxjs';
import { catchError, concatMap, debounceTime, defer, distinctUntilChanged, EMPTY, filter, first, map, type Observable, of, switchMap, tap } from 'rxjs';
import { DEFAULT_DBX_LLM_FLOW_MAX_PERSISTED_RUNS_PER_SECTION, type DbxLlmFlowRun, type DbxLlmFlowRunId, type DbxLlmFlowSectionInput, type DbxLlmFlowSectionKey, type DbxLlmFlowSectionState, type DbxLlmFlowState } from './llm.flow';
import { type DbxLlmFlowStateContext, dbxLlmFlowRunLineage, dbxLlmFlowRunsWithInterruptedRuns, dbxLlmFlowSectionInputIssues, initialDbxLlmFlowSectionState } from './llm.flow.state';
import { type DbxLlmFlowStore } from './llm.flow.store';

/**
 * Default debounce of DbxLlmFlowStorageSync writes.
 */
export const DEFAULT_DBX_LLM_FLOW_STORAGE_DEBOUNCE_TIME: Milliseconds = 300;

// MARK: Persisted State
/**
 * A run as it is persisted. Dates are stored as unix milliseconds.
 */
export interface DbxLlmFlowPersistedRun extends Omit<DbxLlmFlowRun, 'startedAt' | 'finishedAt'> {
  readonly startedAt: UnixDateTimeMillisecondsNumber;
  readonly finishedAt?: Maybe<UnixDateTimeMillisecondsNumber>;
}

/**
 * The persisted part of a section's state.
 */
export interface DbxLlmFlowPersistedSection {
  readonly key: DbxLlmFlowSectionKey;
  readonly parentKey?: Maybe<DbxLlmFlowSectionKey>;
  readonly draft: DbxLlmFlowSectionInput;
  readonly selectedRunIds: readonly DbxLlmFlowRunId[];
  readonly followedParentRunId?: Maybe<DbxLlmFlowRunId>;
  readonly lastFailedRunId?: Maybe<DbxLlmFlowRunId>;
}

/**
 * The persisted flow state. Plain JSON.
 */
export interface DbxLlmFlowPersistedState {
  readonly v: 1;
  readonly sections: Readonly<Record<DbxLlmFlowSectionKey, DbxLlmFlowPersistedSection>>;
  readonly runs: Readonly<Record<DbxLlmFlowRunId, DbxLlmFlowPersistedRun>>;
}

export interface DbxLlmFlowPersistedStateFromStateConfig {
  /**
   * Max runs kept per section, besides the runs that are always kept. Defaults to DEFAULT_DBX_LLM_FLOW_MAX_PERSISTED_RUNS_PER_SECTION.
   */
  readonly maxRunsPerSection?: Maybe<number>;
}

/**
 * Creates the persisted state from the flow state.
 *
 * Runs are pruned: active, selected, anchor (followed parent) and last-failed runs are always kept with their lineage, then the newest runs of each section up to the max.
 *
 * @param state - The flow state.
 * @param config - Optional config.
 * @returns The persisted state.
 */
export function dbxLlmFlowPersistedStateFromState(state: DbxLlmFlowState, config?: Maybe<DbxLlmFlowPersistedStateFromStateConfig>): DbxLlmFlowPersistedState {
  const maxRunsPerSection = config?.maxRunsPerSection ?? DEFAULT_DBX_LLM_FLOW_MAX_PERSISTED_RUNS_PER_SECTION;
  const keep = new Set<DbxLlmFlowRunId>();
  const keepWithLineage = (id: Maybe<DbxLlmFlowRunId>) => dbxLlmFlowRunLineage(state, id).forEach((x) => keep.add(x.id));
  const sections: Record<DbxLlmFlowSectionKey, DbxLlmFlowPersistedSection> = {};
  const runsBySection = new Map<DbxLlmFlowSectionKey, DbxLlmFlowRun[]>();

  for (const section of Object.values(state.sections)) {
    keepWithLineage(section.activeRunId);
    section.selectedRunIds.forEach(keepWithLineage);
    keepWithLineage(section.followedParentRunId);
    keepWithLineage(section.lastFailedRunId);
    sections[section.key] = { key: section.key, parentKey: section.parentKey, draft: section.draft, selectedRunIds: section.selectedRunIds, followedParentRunId: section.followedParentRunId, lastFailedRunId: section.lastFailedRunId };
  }

  for (const run of Object.values(state.runs)) {
    const list = runsBySection.get(run.sectionKey) ?? [];
    list.push(run);
    runsBySection.set(run.sectionKey, list);
  }

  // Reversed before the stable sort, so later runs win ties.
  runsBySection.forEach((list) =>
    list
      .reverse()
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, Math.max(0, maxRunsPerSection))
      .forEach((x) => keep.add(x.id))
  );

  const runs: Record<DbxLlmFlowRunId, DbxLlmFlowPersistedRun> = {};

  keep.forEach((id) => {
    const run = state.runs[id];

    if (run != null) {
      runs[id] = { ...run, startedAt: run.startedAt.getTime(), finishedAt: run.finishedAt?.getTime() };
    }
  });

  return { v: 1, sections, runs };
}

/**
 * Converts persisted runs back to runs.
 *
 * @param runs - The persisted runs.
 * @returns The runs.
 */
export function dbxLlmFlowRunsFromPersistedRuns(runs: Readonly<Record<DbxLlmFlowRunId, DbxLlmFlowPersistedRun>>): Record<DbxLlmFlowRunId, DbxLlmFlowRun> {
  const result: Record<DbxLlmFlowRunId, DbxLlmFlowRun> = {};

  for (const [id, run] of Object.entries(runs)) {
    result[id] = { ...run, startedAt: new Date(run.startedAt), finishedAt: run.finishedAt == null ? undefined : new Date(run.finishedAt) };
  }

  return result;
}

function sectionWithRuntimeFields(base: DbxLlmFlowSectionState, current: Maybe<DbxLlmFlowSectionState>, context: DbxLlmFlowStateContext): DbxLlmFlowSectionState {
  const next: DbxLlmFlowSectionState = {
    ...base,
    draftRevision: (current?.draftRevision ?? 0) + 1,
    draftSource: undefined,
    activeRunId: undefined,
    formValid: current?.formValid,
    mountCount: current?.mountCount ?? 0,
    runBridgeCounts: current?.runBridgeCounts
  };

  return { ...next, inputIssues: dbxLlmFlowSectionInputIssues(next, context.sectionConfig(base.key)) };
}

export interface DbxLlmFlowResetInput {
  readonly storageKey?: Maybe<string>;
  /**
   * Whether the flow is restoring after the reset. Runs are blocked while restoring.
   */
  readonly restoring: boolean;
}

/**
 * Resets every section to its initial draft and drops every run and run request. Mount counts and run bridges are kept, and every revision bumps so forms re-seed.
 *
 * A run that finishes after the reset is dropped, since its run no longer exists.
 *
 * @param state - The state.
 * @param input - The reset input.
 * @param context - The context.
 * @returns The new state.
 */
export function dbxLlmFlowStateWithReset(state: DbxLlmFlowState, input: DbxLlmFlowResetInput, context: DbxLlmFlowStateContext): DbxLlmFlowState {
  const sections: Record<DbxLlmFlowSectionKey, DbxLlmFlowSectionState> = {};

  for (const section of Object.values(state.sections)) {
    sections[section.key] = sectionWithRuntimeFields(initialDbxLlmFlowSectionState(section.key, section.parentKey, context.sectionConfig(section.key)), section, context);
  }

  return { sections, runs: {}, runRequests: {}, restoring: input.restoring, storageKey: input.storageKey ?? undefined };
}

/**
 * Restores a persisted state and ends restoring.
 *
 * Persisted running runs become failed with DBX_LLM_FLOW_RUN_INTERRUPTED_ERROR_CODE, runtime fields reset, every revision bumps so forms re-seed, and selections are filtered to runs that exist and succeeded.
 *
 * @param state - The current state. Its mounted sections and runtime counts are kept.
 * @param persisted - The persisted state. An unknown version or undefined restores a blank state.
 * @param context - The context.
 * @returns The new state.
 */
export function dbxLlmFlowStateWithRestoredPersistedState(state: DbxLlmFlowState, persisted: Maybe<DbxLlmFlowPersistedState>, context: DbxLlmFlowStateContext): DbxLlmFlowState {
  const valid = persisted?.v === 1 ? persisted : undefined;
  const runs = dbxLlmFlowRunsWithInterruptedRuns(dbxLlmFlowRunsFromPersistedRuns(valid?.runs ?? {}), context.now);
  const savedSections = valid?.sections ?? {};
  const keys = new Set([...Object.keys(state.sections), ...Object.keys(savedSections)]);
  const sections: Record<DbxLlmFlowSectionKey, DbxLlmFlowSectionState> = {};
  const existingRunId = (id: Maybe<DbxLlmFlowRunId>) => (id != null && runs[id] != null ? id : undefined);

  keys.forEach((key) => {
    const current = state.sections[key];
    const saved = savedSections[key];
    const initial = initialDbxLlmFlowSectionState(key, current?.parentKey ?? saved?.parentKey, context.sectionConfig(key));
    const base: DbxLlmFlowSectionState = {
      ...initial,
      draft: saved?.draft ?? initial.draft,
      selectedRunIds: (saved?.selectedRunIds ?? []).filter((id) => runs[id]?.state === 'success'),
      followedParentRunId: existingRunId(saved?.followedParentRunId),
      lastFailedRunId: existingRunId(saved?.lastFailedRunId)
    };

    sections[key] = sectionWithRuntimeFields(base, current, context);
  });

  return { sections, runs, runRequests: {}, restoring: false, storageKey: state.storageKey };
}

/**
 * Whether the error is a storage quota error.
 *
 * @param error - The error.
 * @returns True for quota errors.
 */
export function isDbxLlmFlowStorageQuotaError(error: unknown): boolean {
  const x = error as Maybe<{ readonly name?: string; readonly code?: number }>;
  return x?.name === 'QuotaExceededError' || x?.name === 'NS_ERROR_DOM_QUOTA_REACHED' || x?.code === 22 || x?.code === 1014;
}

// MARK: Storage Sync
export interface DbxLlmFlowStorageSyncConfig {
  readonly store: DbxLlmFlowStore;
  /**
   * Accessor the persisted states are read from and written to, keyed by storage key.
   */
  readonly accessor: LimitedStorageAccessor<DbxLlmFlowPersistedState>;
  /**
   * The storage key. Switching keys saves the old key, resets the flow, then restores the new key. Undefined disables persistence.
   */
  readonly storageKey$: Observable<Maybe<string>>;
  readonly debounceTime?: Maybe<Milliseconds>;
  readonly maxRunsPerSection?: Maybe<number>;
}

/**
 * Keeps a DbxLlmFlowStore in sync with storage.
 *
 * Writes are debounced and blocked while restoring. Read errors restore a blank state. On a quota error the max runs per section is halved and the write retried.
 */
export class DbxLlmFlowStorageSync implements Destroyable {
  private readonly _keySub = new SubscriptionObject();
  private readonly _saveSub = new SubscriptionObject();
  private readonly _lastWritten = new Map<string, string>();
  private _maxRunsPerSection: number;

  constructor(readonly config: DbxLlmFlowStorageSyncConfig) {
    this._maxRunsPerSection = config.maxRunsPerSection ?? DEFAULT_DBX_LLM_FLOW_MAX_PERSISTED_RUNS_PER_SECTION;
  }

  get maxRunsPerSection(): number {
    return this._maxRunsPerSection;
  }

  init(): void {
    const { store } = this.config;

    this._keySub.subscription = this.config.storageKey$
      .pipe(
        map((x) => x ?? undefined),
        distinctUntilChanged(),
        concatMap((key) => this._switchToKey(key))
      )
      .subscribe();

    this._saveSub.subscription = store.state$
      .pipe(
        filter((x) => !x.restoring && x.storageKey != null),
        debounceTime(this.config.debounceTime ?? DEFAULT_DBX_LLM_FLOW_STORAGE_DEBOUNCE_TIME),
        concatMap((x) => this._write(x, this._maxRunsPerSection))
      )
      .subscribe();
  }

  /**
   * Saves the store's current state immediately.
   *
   * @returns Observable that completes once saved.
   */
  saveNow(): Observable<void> {
    return defer(() => {
      const state = this.config.store.currentState();
      return state.restoring || state.storageKey == null ? of(undefined) : this._write(state, this._maxRunsPerSection);
    });
  }

  private _switchToKey(key: Maybe<string>): Observable<void> {
    return defer(() => {
      const { store, accessor } = this.config;
      const current = store.currentState();
      let result: Observable<void>;

      if (current.storageKey === key && !current.restoring) {
        result = EMPTY;
      } else {
        result = this.saveNow().pipe(
          switchMap(() => {
            store.beginRestore(key);
            return key == null ? of(undefined) : accessor.get(key).pipe(first());
          }),
          catchError(() => of(undefined)),
          map((persisted) => store.restorePersistedState(persisted))
        );
      }

      return result;
    });
  }

  private _write(state: DbxLlmFlowState, maxRunsPerSection: number): Observable<void> {
    const key = state.storageKey as string;
    const persisted = dbxLlmFlowPersistedStateFromState(state, { maxRunsPerSection });
    const json = JSON.stringify(persisted);
    let result: Observable<void>;

    if (this._lastWritten.get(key) === json) {
      result = of(undefined);
    } else {
      result = this.config.accessor.set(key, persisted).pipe(
        tap(() => this._lastWritten.set(key, json)),
        catchError((e) => {
          let retry: Observable<void> = of(undefined);

          if (isDbxLlmFlowStorageQuotaError(e) && maxRunsPerSection > 1) {
            this._maxRunsPerSection = Math.floor(maxRunsPerSection / 2);
            retry = this._write(state, this._maxRunsPerSection);
          }

          return retry;
        })
      );
    }

    return result;
  }

  destroy(): void {
    this.saveNow().subscribe();
    this._keySub.destroy();
    this._saveSub.destroy();
  }
}
