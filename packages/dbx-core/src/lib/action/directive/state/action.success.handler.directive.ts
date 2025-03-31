import { map, tap, shareReplay, switchMap, BehaviorSubject } from 'rxjs';
import { filterMaybe } from '@dereekb/rxjs';
import { Directive, Input, OnInit, OnDestroy, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Performs the action on success.
 */
export type DbxActionSuccessHandlerFunction<O = unknown> = (value: O) => void;

/**
 * Directive that executes a function on ActionContextStore Success.
 */
@Directive({
  selector: '[dbxActionSuccessHandler]',
  standalone: true
})
export class DbxActionSuccessHandlerDirective<T, O> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  readonly dbxActionSuccessHandler = input<Maybe<DbxActionSuccessHandlerFunction<O>>>();
  readonly successFunction$ = toObservable(this.dbxActionSuccessHandler).pipe(filterMaybe(), shareReplay(1));

  ngOnInit(): void {
    this.sub = this.successFunction$
      .pipe(
        switchMap((successFunction) =>
          this.source.success$.pipe(
            map((x) => [successFunction, x] as [DbxActionSuccessHandlerFunction<O>, O]),
            tap(([successFn, result]) => {
              successFn(result);
            })
          )
        )
      )
      .subscribe();
  }
}
