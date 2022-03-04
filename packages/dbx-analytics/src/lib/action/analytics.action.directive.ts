import { filterMaybe } from '@dereekb/rxjs';
import { switchMap, tap, shareReplay } from 'rxjs/operators';
import { Host, Directive, Input, OnInit, OnDestroy } from '@angular/core';
import { BehaviorSubject, merge, Observable, of } from 'rxjs';
import { ActionContextStoreSourceInstance, AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxAnalyticsService } from '../analytics/analytics.service';
import { Maybe, ReadableError } from '@dereekb/util';

export enum DbxActionAnalyticsTriggerType {
  TRIGGER,
  READY,
  SUCCESS,
  ERROR
}

export interface DbxActionAnalyticsConfig<T = any, O = any> {
  onTriggered: (service: DbxAnalyticsService) => void;
  onReady: (service: DbxAnalyticsService, value: T) => void;
  onSuccess: (service: DbxAnalyticsService, value: Maybe<O>) => void;
  onError: (service: DbxAnalyticsService, error: Maybe<ReadableError>) => void;
}

/**
 * Used to listen to an ActionContext and send analytical events based on action events.
 */
@Directive({
  selector: '[dbxActionAnalytics]',
})
export class DbxActionAnalyticsDirective<T> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  private _config = new BehaviorSubject<Maybe<DbxActionAnalyticsConfig>>(undefined);
  readonly config$ = this._config.pipe(filterMaybe(), shareReplay(1));

  @Input('dbxActionAnalytics')
  get config(): Maybe<DbxActionAnalyticsConfig> {
    return this._config.value;
  }

  set config(config: Maybe<DbxActionAnalyticsConfig>) {
    this._config.next(config);
  }

  constructor(
    @Host() readonly source: ActionContextStoreSourceInstance,
    readonly analyticsService: DbxAnalyticsService
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
