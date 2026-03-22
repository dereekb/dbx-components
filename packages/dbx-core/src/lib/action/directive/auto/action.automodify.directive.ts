import { Directive, inject, input } from '@angular/core';
import { cleanSubscriptionWithLockSet } from '../../../rxjs';
import { distinctUntilChanged, filter, switchMap, type Observable, EMPTY } from 'rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { isNotFalse } from '@dereekb/util';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Directive that automatically marks the parent action as modified whenever it becomes unmodified.
 *
 * This ensures the action is always considered "modified" and therefore always eligible for triggering.
 * Useful in combination with {@link DbxActionAutoTriggerDirective} and {@link DbxActionEnforceModifiedDirective}
 * when the action should be continuously available for submission.
 *
 * Can be disabled by setting `dbxActionAutoModify` to `false`.
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <ng-container dbxActionAutoModify></ng-container>
 *   <ng-container dbxActionAutoTrigger></ng-container>
 * </div>
 * ```
 *
 * @typeParam T - The input value type for the action.
 * @typeParam O - The output result type for the action.
 *
 * @see {@link DbxActionAutoTriggerDirective} for automatically triggering modified actions.
 */
@Directive({
  selector: 'dbxActionAutoModify, [dbxActionAutoModify]',
  standalone: true
})
export class DbxActionAutoModifyDirective<T, O> {
  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });
  readonly autoModifyEnabled = input<boolean, string | boolean>(true, { alias: 'dbxActionAutoModify', transform: isNotFalse });
  readonly markAsModified$: Observable<void> = toObservable(this.autoModifyEnabled).pipe(
    distinctUntilChanged(),
    switchMap((x) => {
      let obs: Observable<any>;

      if (x) {
        obs = this.source.isModified$.pipe(filter((x) => !x));
      } else {
        obs = EMPTY;
      }

      return obs;
    })
  );

  constructor() {
    cleanSubscriptionWithLockSet({
      lockSet: this.source.lockSet,
      sub: this.markAsModified$.subscribe(() => {
        this.source.setIsModified(true);
      })
    });
  }
}
