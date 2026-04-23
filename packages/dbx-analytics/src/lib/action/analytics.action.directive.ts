import { filterMaybe } from '@dereekb/rxjs';
import { switchMap, tap, shareReplay, merge, type Observable, of } from 'rxjs';
import { Directive, inject, input } from '@angular/core';
import { DbxActionContextStoreSourceInstance, cleanSubscriptionWithLockSet } from '@dereekb/dbx-core';
import { DbxAnalyticsService } from '../analytics/analytics.service';
import { type Maybe, type ReadableError } from '@dereekb/util';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Configuration for {@link DbxActionAnalyticsDirective} that maps action lifecycle events to analytics calls.
 *
 * Each callback receives the {@link DbxAnalyticsService} and relevant action data, allowing you to
 * send targeted analytics events at each stage of an action's lifecycle (trigger, ready, success, error).
 *
 * @example
 * ```ts
 * // In a component, define analytics config for a form submit action
 * readonly submitAnalytics: DbxActionAnalyticsConfig<MyFormValue, MyResult> = {
 *   onReady: (service, value) => {
 *     service.sendEventData('Form Submitted', { formType: 'onboard' });
 *   },
 *   onSuccess: (service, result, value) => {
 *     service.sendEventType('Onboarding Complete');
 *   },
 *   onError: (service, error) => {
 *     service.sendEventData('Form Submit Failed', { code: error?.code ?? 'unknown' });
 *   }
 * };
 *
 * // In the template
 * // <button dbxAction [dbxActionAnalytics]="submitAnalytics">Submit</button>
 * ```
 */
export interface DbxActionAnalyticsConfig<T = unknown, O = unknown> {
  /**
   * Called when the action is triggered (button pressed).
   */
  readonly onTriggered?: (service: DbxAnalyticsService) => void;
  /**
   * Called when the action value is ready and about to be processed.
   */
  readonly onReady?: (service: DbxAnalyticsService, value: T) => void;
  /**
   * Called when the action completes successfully.
   */
  readonly onSuccess?: (service: DbxAnalyticsService, result: Maybe<O>, value: T) => void;
  /**
   * Called when the action encounters an error.
   */
  readonly onError?: (service: DbxAnalyticsService, error: Maybe<ReadableError>) => void;
}

/**
 * Standalone directive that listens to a host {@link DbxActionDirective} and fires analytics events
 * based on the action's lifecycle (triggered, ready, success, error).
 *
 * Attach to any element that has a `dbxAction` directive and pass a {@link DbxActionAnalyticsConfig}
 * to define which events to send at each lifecycle stage.
 *
 * @example
 * ```html
 * <button dbxAction
 *   [dbxActionHandler]="handleSave"
 *   [dbxActionAnalytics]="saveAnalytics">
 *   Save
 * </button>
 * ```
 */
@Directive({
  selector: '[dbxActionAnalytics]',
  standalone: true
})
export class DbxActionAnalyticsDirective<T, O> {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });
  readonly analyticsService = inject(DbxAnalyticsService);

  readonly config = input<Maybe<DbxActionAnalyticsConfig<T, O>>>(undefined, { alias: 'dbxActionAnalytics' });
  readonly config$ = toObservable(this.config).pipe(filterMaybe(), shareReplay(1));

  constructor() {
    cleanSubscriptionWithLockSet({
      lockSet: this.source.lockSet,
      sub: this.config$
        .pipe(
          switchMap(({ onTriggered, onReady, onSuccess, onError }) => {
            const triggerObs: Observable<unknown>[] = [];

            if (onTriggered) {
              triggerObs.push(this.source.triggered$.pipe(tap(() => onTriggered(this.analyticsService))));
            }

            if (onReady) {
              triggerObs.push(this.source.valueReady$.pipe(tap((value) => onReady(this.analyticsService, value))));
            }

            if (onSuccess) {
              triggerObs.push(this.source.successPair$.pipe(tap(({ result, value }) => onSuccess(this.analyticsService, result, value))));
            }

            if (onError) {
              triggerObs.push(
                this.source.error$.pipe(
                  filterMaybe(),
                  tap((error) => onError(this.analyticsService, error))
                )
              );
            }

            return triggerObs.length ? merge(...triggerObs) : of();
          })
        )
        .subscribe()
    });
  }
}
