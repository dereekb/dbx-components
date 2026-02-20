import { map, tap, shareReplay, switchMap } from 'rxjs';
import { filterMaybe } from '@dereekb/rxjs';
import { Directive, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { cleanSubscription } from '../../../rxjs';
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
export class DbxActionSuccessHandlerDirective<T, O> {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  readonly dbxActionSuccessHandler = input<Maybe<DbxActionSuccessHandlerFunction<O>>>();
  readonly successFunction$ = toObservable(this.dbxActionSuccessHandler).pipe(filterMaybe(), shareReplay(1));

  constructor() {
    cleanSubscription(
      this.successFunction$
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
        .subscribe()
    );
  }
}
