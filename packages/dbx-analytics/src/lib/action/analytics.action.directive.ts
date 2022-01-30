import { filterMaybe } from '@dereekb/rxjs';
import { switchMap, tap, shareReplay } from 'rxjs/operators';
import { Host, Directive, Input, OnInit, OnDestroy } from '@angular/core';
import { BehaviorSubject, merge, Observable, of } from 'rxjs';
import { ActionContextStoreSourceInstance, AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbNgxAnalyticsService } from '../analytics/analytics.service';
import { Maybe, ReadableError } from '@dereekb/util';

export enum DbNgxActionAnalyticsTriggerType {
  TRIGGER,
  READY,
  SUCCESS,
  ERROR
}

export interface DbNgxActionAnalyticsConfig<T = any, O = any> {
  onTriggered: (service: DbNgxAnalyticsService) => void;
  onReady: (service: DbNgxAnalyticsService, value: T) => void;
  onSuccess: (service: DbNgxAnalyticsService, value: Maybe<O>) => void;
  onError: (service: DbNgxAnalyticsService, error: Maybe<ReadableError>) => void;
}

/**
 * Used to listen to an ActionContext and send analytical events based on action events.
 */
@Directive({
  selector: '[dbxActionAnalytics]',
})
export class DbNgxActionAnalyticsDirective<T> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  private _config = new BehaviorSubject<Maybe<DbNgxActionAnalyticsConfig>>(undefined);
  readonly config$ = this._config.pipe(filterMaybe(), shareReplay(1));

  @Input('dbxActionAnalytics')
  get config(): Maybe<DbNgxActionAnalyticsConfig> {
    return this._config.value;
  }

  set config(config: Maybe<DbNgxActionAnalyticsConfig>) {
    this._config.next(config);
  }

  constructor(
    @Host() readonly source: ActionContextStoreSourceInstance,
    readonly analyticsService: DbNgxAnalyticsService
  ) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.config$.pipe(
      switchMap(({ onTriggered, onReady, onSuccess, onError }) => {
        const triggerObs: Observable<any>[] = [];

        if (onTriggered) {
          triggerObs.push(this.source.triggered$.pipe(
            tap(() => onTriggered(this.analyticsService))
          ));
        }

        if (onReady) {
          triggerObs.push(this.source.valueReady$.pipe(
            tap((value) => onReady(this.analyticsService, value))
          ));
        }

        if (onSuccess) {
          triggerObs.push(this.source.success$.pipe(
            tap((result) => onSuccess(this.analyticsService, result))
          ));
        }

        if (onError) {
          triggerObs.push(this.source.error$.pipe(
            tap((error) => onError(this.analyticsService, error))
          ));
        }

        if (triggerObs.length) {
          return merge(triggerObs);
        } else {
          return of();
        }
      })
    ).subscribe();
  }

  override ngOnDestroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      super.ngOnDestroy();
      this._config.complete();
    });
  }

}
