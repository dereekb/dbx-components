import { map, tap, shareReplay, switchMap } from 'rxjs';
import { filterMaybe } from '@dereekb/rxjs';
import { Directive, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { cleanSubscriptionWithLockSet } from '../../../rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Callback function invoked when an action resolves successfully.
 *
 * @typeParam O - The output result type from the action.
 */
export type DbxActionSuccessHandlerFunction<O = unknown> = (value: O) => void;

/**
 * Directive that executes a callback function each time the action resolves successfully.
 *
 * The provided function receives the action's result value. This is useful for
 * performing side effects like navigation, showing notifications, or refreshing data
 * after a successful action.
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <ng-container [dbxActionSuccessHandler]="onSaveSuccess"></ng-container>
 *   <button (click)="action.trigger()">Save</button>
 * </div>
 * ```
 *
 * @typeParam T - The input value type.
 * @typeParam O - The output result type.
 *
 * @see {@link DbxActionHasSuccessDirective} for rendering content on success.
 * @see {@link DbxActionErrorHandlerDirective} for handling errors.
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
    cleanSubscriptionWithLockSet({
      lockSet: this.source.lockSet,
      sub: this.successFunction$
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
    });
  }
}
