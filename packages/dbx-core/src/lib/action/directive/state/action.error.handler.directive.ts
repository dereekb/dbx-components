import { map, tap, shareReplay, switchMap } from 'rxjs';
import { filterMaybe } from '@dereekb/rxjs';
import { Directive, inject, input } from '@angular/core';
import { type ReadableError, type Maybe } from '@dereekb/util';
import { cleanSubscriptionWithLockSet } from '../../../rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Callback function invoked when an action encounters an error.
 *
 * Receives the {@link ReadableError} if available, or undefined.
 */
export type DbxActionErrorHandlerFunction = (error?: Maybe<ReadableError>) => void;

/**
 * Directive that executes a callback function each time the action's error state changes.
 *
 * The provided function receives the {@link ReadableError} from the action context.
 * This is useful for performing side effects like logging, showing error toasts, or
 * handling specific error conditions programmatically.
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <ng-container [dbxActionErrorHandler]="onError"></ng-container>
 *   <button (click)="action.trigger()">Submit</button>
 * </div>
 * ```
 *
 * @typeParam T - The input value type.
 * @typeParam O - The output result type.
 *
 * @see {@link DbxActionSuccessHandlerDirective} for handling success.
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
    cleanSubscriptionWithLockSet({
      lockSet: this.source.lockSet,
      sub: this.errorFunction$
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
    });
  }
}
