import { exhaustMap, map, switchMap, tap } from 'rxjs/operators';
import { Host, Directive, Input, OnInit, OnDestroy } from '@angular/core';
import { BehaviorSubject, merge, Observable, of } from 'rxjs';
import { ActionContextStoreSourceInstance } from '@dereekb/ngx-actions';
import { AbstractSubscriptionDirective, CodedError } from '@dereekb/ngx-core';
import { DbNgxAnalyticsService } from '../analytics.service';

export enum DbNgxActionAnalyticsTriggerType {
  TRIGGER,
  READY,
  SUCCESS,
  ERROR
}

export interface DbNgxActionAnalyticsConfig<T = any, O = any> {
  onTriggered: (service: DbNgxAnalyticsService) => void;
  onReady: (service: DbNgxAnalyticsService, value: T) => void;
  onSuccess: (service: DbNgxAnalyticsService, value: O) => void;
  onError: (service: DbNgxAnalyticsService, error: ReadableError) => void;
}

/**
 * Used to listen to an ActionContext and send analytical events based on action events.
 */
@Directive({
  selector: '[dbxActionAnalytics]',
})
export class DbNgxActionAnalyticsDirective<T> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {

  private _config = new BehaviorSubject<DbNgxActionAnalyticsConfig>(undefined);
  readonly config$ = this._config.asObservable();

  @Input('dbxActionAnalytics')
  get config(): DbNgxActionAnalyticsConfig {
    return this._config.value;
  }

  set config(config: DbNgxActionAnalyticsConfig) {
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
          triggerObs.push(this.source.triggered$.pipe(
            tap((result) => onSuccess(this.analyticsService, result))
          ));
        }

        if (onError) {
          triggerObs.push(this.source.triggered$.pipe(
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

  ngOnDestroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      super.ngOnDestroy();
      this._config.complete();
    });
  }

}
