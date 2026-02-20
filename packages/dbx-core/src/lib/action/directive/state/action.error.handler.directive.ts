import { map, tap, shareReplay, switchMap } from 'rxjs';
import { filterMaybe } from '@dereekb/rxjs';
import { Directive, inject, input } from '@angular/core';
import { ReadableError, type Maybe } from '@dereekb/util';
import { cleanSubscription } from '../../../rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Performs the action on error.
 */
export type DbxActionErrorHandlerFunction = (error?: Maybe<ReadableError>) => void;

/**
 * Directive that executes a function on ActionContextStore error.
 */
@Directive({
  selector: '[dbxActionErrorHandler]',
  standalone: true
})
export class DbxActionErrorHandlerDirective<T, O> {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  readonly dbxActionErrorHandler = input<Maybe<DbxActionErrorHandlerFunction>>();
  readonly errorFunction$ = toObservable(this.dbxActionErrorHandler).pipe(filterMaybe(), shareReplay(1));

  constructor() {
    cleanSubscription(
      this.errorFunction$
        .pipe(
          switchMap((errorFunction) =>
            this.source.error$.pipe(
              filterMaybe(),
              map((x) => [errorFunction, x] as const),
              tap(([errorFn, error]) => {
                errorFn(error);
              })
            )
          )
        )
        .subscribe()
    );
  }
}
