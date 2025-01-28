import { filterMaybe } from '@dereekb/rxjs';
import { switchMap, tap, shareReplay, BehaviorSubject, merge, Observable, of } from 'rxjs';
import { Directive, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { DbxActionContextStoreSourceInstance, AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxAnalyticsService } from '../analytics/analytics.service';
import { Maybe, ReadableError } from '@dereekb/util';

/**
 * DbxActionAnalyticsDirective config
 */
export interface DbxActionAnalyticsConfig<T = unknown, O = unknown> {
  onTriggered?: (service: DbxAnalyticsService) => void;
  onReady?: (service: DbxAnalyticsService, value: T) => void;
  onSuccess?: (service: DbxAnalyticsService, result: Maybe<O>, value: T) => void;
  onError?: (service: DbxAnalyticsService, error: Maybe<ReadableError>) => void;
}

/**
 * Used to listen to an ActionContext and send analytical events based on action events.
 */
@Directive({
  selector: '[dbxActionAnalytics]'
})
export class DbxActionAnalyticsDirective<T, O> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });
  readonly analyticsService = inject(DbxAnalyticsService);

  private readonly _config = new BehaviorSubject<Maybe<DbxActionAnalyticsConfig<T, O>>>(undefined);
  readonly config$ = this._config.pipe(filterMaybe(), shareReplay(1));

  @Input('dbxActionAnalytics')
  get config(): Maybe<DbxActionAnalyticsConfig<T, O>> {
    return this._config.value;
  }

  set config(config: Maybe<DbxActionAnalyticsConfig<T, O>>) {
    this._config.next(config);
  }

  ngOnInit(): void {
    this.sub = this.config$
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

          if (triggerObs.length) {
            return merge(...triggerObs);
          } else {
            return of();
          }
        })
      )
      .subscribe();
  }

  override ngOnDestroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      super.ngOnDestroy();
      this._config.complete();
    });
  }
}
