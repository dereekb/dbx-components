import { Component, computed, effect, inject, input } from '@angular/core';
import { AbstractDbxActionHandlerDirective, actionContextIsModifiedAndCanTrigger, FilterSourceDirective, isIdleActionState, provideActionStoreSource } from '@dereekb/dbx-core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DbxButtonModule } from '../../button/button.module';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { type WorkInstance } from '@dereekb/rxjs';
import { type Maybe, type Milliseconds } from '@dereekb/util';
import { filter, first, firstValueFrom, type Observable, of, switchMap, timer } from 'rxjs';
import { DbxFilterPopoverPendingChanges } from './filter.popover.pending';

/**
 * How long the action state must stay unchanged before {@link DbxFilterWrapperComponent.applyPendingFilter} decides whether there is a change to apply.
 */
export const DBX_FILTER_WRAPPER_APPLY_PENDING_SETTLE_TIME: Milliseconds = 100;

/**
 * Emits the latest value once it has stayed the same for settleTime, measured by a timer that fired on time.
 *
 * A timer that fires late (behind a long task) restarts the wait, so the work queued behind that task runs first.
 *
 * @param value$ - Values to settle.
 * @param settleTime - How long a value must stay the same.
 * @returns Emits the settled value once, then completes.
 */
function settledValue<T>(value$: Observable<T>, settleTime: Milliseconds): Observable<T> {
  return value$.pipe(
    switchMap((value) => {
      const waitOnTime = (): Observable<T> => {
        const startedAt = Date.now();
        return timer(settleTime).pipe(switchMap(() => (Date.now() - startedAt > settleTime * 2 ? waitOnTime() : of(value))));
      };

      return waitOnTime();
    }),
    first()
  );
}

/**
 * Wraps filter form content with apply/reset buttons, integrating with the action system.
 *
 * Provides an ActionContextStoreSource and applies the filter value to the nearest FilterSourceDirective on trigger.
 *
 * Inside a filter popover, a wrapper whose Apply button is hidden applies its last change before the popover closes (see {@link applyOnClose}),
 * so a change made right before clicking the popover's close button or outside of it is not lost.
 *
 * @example
 * ```html
 * <dbx-filter-wrapper [applyText]="'Apply'" [applyIcon]="'filter_list'">
 *   <my-filter-form dbxActionForm></my-filter-form>
 * </dbx-filter-wrapper>
 * ```
 */
@Component({
  selector: 'dbx-filter-wrapper',
  templateUrl: './filter.wrapper.component.html',
  providers: [provideActionStoreSource(null)],
  imports: [DbxButtonModule, MatButtonModule, MatIconModule, FlexLayoutModule]
})
export class DbxFilterWrapperComponent<F = unknown> extends AbstractDbxActionHandlerDirective<F> {
  readonly filterSourceDirective = inject(FilterSourceDirective<F>);

  readonly showButtons = input(true);
  readonly applyRaised = input(true);
  readonly applyIcon = input('filter_list');
  readonly applyText = input('Filter');

  /**
   * Whether or not to apply a pending change before the filter popover this wrapper is in closes.
   *
   * Defaults to `!showButtons`: a wrapper without its own Apply button applies by itself (such as with dbxActionAutoTrigger),
   * so its last change is kept. With the Apply button shown, closing without clicking it discards the change.
   */
  readonly applyOnClose = input<Maybe<boolean>>();

  readonly applyOnCloseSignal = computed(() => {
    const applyOnClose = this.applyOnClose();
    const showButtons = this.showButtons();
    return applyOnClose ?? !showButtons;
  });

  constructor() {
    super();

    // TODO: Consider throwing an error if dbxAction is provided at the same time as this, since the source would not be used?

    // configure handler function
    this._dbxActionHandlerInstance.setHandlerFunction((filter: F, instance: WorkInstance<F, unknown>) => {
      this.filterSourceDirective.setFilter(filter);
      instance.success(true);
    });

    const pendingChanges = inject(DbxFilterPopoverPendingChanges, { optional: true });

    if (pendingChanges) {
      // inside a filter popover: apply a change the action has not applied yet before the popover closes
      effect((onCleanup) => {
        if (this.applyOnCloseSignal()) {
          onCleanup(pendingChanges.registerApplyPending(() => this.applyPendingFilter()));
        }
      });
    }
  }

  /**
   * Applies a change the action has not applied yet.
   *
   * Waits until the action state has settled, triggers the action if it is modified and can be triggered, then waits until the action is idle.
   *
   * @returns Resolves once the action is idle.
   */
  applyPendingFilter(): Promise<void> {
    const state$ = this.source.state$;

    const applied$ = settledValue(state$, DBX_FILTER_WRAPPER_APPLY_PENDING_SETTLE_TIME).pipe(
      switchMap((state) => {
        if (actionContextIsModifiedAndCanTrigger(state)) {
          this.source.trigger();
        }

        return state$.pipe(filter((x) => isIdleActionState(x.actionState)));
      }),
      first()
    );

    return firstValueFrom(applied$, { defaultValue: undefined }).then(() => undefined);
  }

  applyFilter(): void {
    this.source.setIsModified(true); // Force setting modified.
    this.source.trigger();
  }

  resetFilter(): void {
    this.filterSourceDirective.resetFilter();
  }
}
