import { computed, Directive, inject, input } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { AbstractDbxActionValueGetterDirective, type AbstractDbxActionValueGetterDirectiveConfig, clean, cleanSubscription, cleanSubscriptionWithLockSet } from '@dereekb/dbx-core';
import { filterMaybe } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { combineLatest, filter, first, map, Observable, switchMap } from 'rxjs';
import { DBX_LLM_FLOW_RUN_BLOCKED_ERROR_CODE, DBX_LLM_FLOW_SECTION_RUN_DISABLED_KEY, type DbxLlmFlowRunBlockedReason, type DbxLlmFlowRunId, type DbxLlmFlowRunKind, type DbxLlmFlowRunValue, dbxLlmFlowRunErrorFromInput, dbxLlmFlowRunKind } from './llm.flow';
import { DbxLlmFlowSectionStore } from './llm.flow.section.store';

/**
 * Thrown by the run bridge's value getter when the section can't run. The action is rejected with it.
 */
export class DbxLlmFlowRunBlockedError extends Error {
  readonly code = DBX_LLM_FLOW_RUN_BLOCKED_ERROR_CODE;

  constructor(readonly blockedReason: Maybe<DbxLlmFlowRunBlockedReason>) {
    super(`The run is blocked (${blockedReason ?? 'unknown'}).`);
    this.name = 'DbxLlmFlowRunBlockedError';
  }
}

/**
 * Bridges a dbxAction to a section's run of one kind.
 *
 * - When the action triggers, a run is started with the section's draft and its DbxLlmFlowRunValue becomes the action value. A blocked section rejects the action.
 * - A successful action completes the run with its result. A rejected action fails it. Both are recorded even after the bridge unmounts, until the action finishes.
 * - The action is disabled while the section can't run.
 * - Run requests (requestRun(), autoRunAfterParent, rerun()) for the kind trigger the action.
 *
 * @example
 * ```html
 * <dbx-button dbxAction dbxActionButton [dbxActionHandler]="handler" [dbxLlmFlowSectionRun]="'plan'" text="Plan"></dbx-button>
 * ```
 */
@Directive({
  selector: '[dbxLlmFlowSectionRun]',
  exportAs: 'dbxLlmFlowSectionRun',
  standalone: true
})
export class DbxLlmFlowSectionRunDirective<F = unknown, O = unknown> extends AbstractDbxActionValueGetterDirective<DbxLlmFlowRunValue<F, O>> {
  readonly sectionStore = inject(DbxLlmFlowSectionStore<F, O>);

  /**
   * The run kind. Defaults to DEFAULT_DBX_LLM_FLOW_RUN_KIND.
   */
  readonly dbxLlmFlowSectionRun = input<Maybe<DbxLlmFlowRunKind | ''>>();
  readonly kindSignal = computed(() => dbxLlmFlowRunKind(this.dbxLlmFlowSectionRun() || undefined));

  private readonly _kind$ = toObservable(this.kindSignal);
  private _currentRunId: Maybe<DbxLlmFlowRunId>;

  constructor() {
    super();

    this.setValueGetterFunction(() => {
      const result = this.sectionStore.startRun(this.kindSignal());

      if (result.value == null) {
        throw new DbxLlmFlowRunBlockedError(result.blockedReason);
      }

      this._currentRunId = result.value.runId;
      return result.value;
    });

    // record completions even after the bridge unmounts, until the action unlocks
    cleanSubscriptionWithLockSet({
      lockSet: this.source.lockSet,
      sub: () =>
        this.source.successPair$.subscribe(({ value, result }) => {
          this.sectionStore.completeRun(value.runId, result as Maybe<O>);

          if (this._currentRunId === value.runId) {
            this._currentRunId = undefined;
          }
        })
    });

    cleanSubscriptionWithLockSet({
      lockSet: this.source.lockSet,
      sub: () =>
        this.source.rejected$.subscribe((error) => {
          const runId = this._currentRunId;

          if (runId != null) {
            this._currentRunId = undefined;
            this.sectionStore.failRun(runId, dbxLlmFlowRunErrorFromInput(error));
          }
        })
    });

    // register the bridge for the kind
    cleanSubscription(
      combineLatest([this.sectionStore.key$, this._kind$])
        .pipe(switchMap(([, kind]) => new Observable<never>(() => this.sectionStore.registerRunBridge(kind))))
        .subscribe()
    );

    // gating
    cleanSubscription(this.sectionStore.canRun$.subscribe((canRun) => this.source.enable(DBX_LLM_FLOW_SECTION_RUN_DISABLED_KEY, canRun)));
    clean(() => this.source.enable(DBX_LLM_FLOW_SECTION_RUN_DISABLED_KEY, true));

    // run requests
    cleanSubscription(
      this._kind$
        .pipe(
          switchMap((kind) => this.sectionStore.runRequestForKind$(kind)),
          filterMaybe(),
          switchMap((request) =>
            this.source.canTrigger$.pipe(
              filter((x) => x),
              first(),
              map(() => request)
            )
          )
        )
        .subscribe((request) => {
          if (this.sectionStore.consumeRunRequest(request.id)) {
            this.source.trigger();
          }
        })
    );
  }

  protected override valueGetterConfig(): AbstractDbxActionValueGetterDirectiveConfig {
    return { registerValueSnapshot: false };
  }
}
