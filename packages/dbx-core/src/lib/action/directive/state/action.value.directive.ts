import { Directive, inject, input } from '@angular/core';
import { getValueFromGetter, type Maybe, type GetterOrValue } from '@dereekb/util';
import { filterMaybe } from '@dereekb/rxjs';
import { BehaviorSubject, combineLatest, map, type Observable, shareReplay, switchMap } from 'rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { toObservable } from '@angular/core/rxjs-interop';
import { cleanSubscriptionWithLockSet } from '../../../rxjs';

/**
 * Directive that provides a value (or value-producing function) to the action when triggered.
 *
 * The value is always available and ready to be used. When the action is triggered,
 * the current value is resolved (via `getValueFromGetter` if a function) and passed
 * to `readyValue()` on the action source.
 *
 * The input filters out null/undefined values, waiting until a non-null value is provided.
 * If you need to pass null/undefined as valid action values, use {@link DbxActionValueTriggerDirective} instead.
 *
 * @dbxAction
 * @dbxActionSlug value
 * @dbxActionStateInteraction TRIGGERED, VALUE_READY
 * @dbxActionConsumesContext
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <ng-container [dbxActionValue]="myValue"></ng-container>
 *   <button (click)="action.trigger()">Submit</button>
 * </div>
 * ```
 *
 * @example
 * ```html
 * <!-- With a getter function -->
 * <div dbxAction>
 *   <ng-container [dbxActionValue]="getLatestValue"></ng-container>
 *   <button (click)="action.trigger()">Submit</button>
 * </div>
 * ```
 *
 * @typeParam T - The input value type.
 * @typeParam O - The output result type.
 *
 * @see {@link DbxActionValueTriggerDirective} for lazy value retrieval on trigger.
 * @see {@link DbxActionValueStreamDirective} for reactive stream-based values.
 */
@Directive({
  selector: 'dbxActionValue,[dbxActionValue]',
  standalone: true
})
export class DbxActionValueDirective<T, O> {
  readonly valueOrFunction = input<Maybe<GetterOrValue<T> | ''>>('', { alias: 'dbxActionValue' });

  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  private readonly _valueOrFunctionOverride = new BehaviorSubject<Maybe<GetterOrValue<T>>>(undefined);

  readonly valueOrFunction$: Observable<GetterOrValue<T>> = combineLatest([this._valueOrFunctionOverride, toObservable(this.valueOrFunction)]).pipe(
    map(([x, y]) => x ?? (y as Maybe<GetterOrValue<T>>)),
    filterMaybe(),
    shareReplay(1)
  );

  constructor() {
    cleanSubscriptionWithLockSet({
      lockSet: this.source.lockSet,
      sub: this.valueOrFunction$.pipe(switchMap((valueOrFunction) => this.source.triggered$.pipe(map(() => valueOrFunction)))).subscribe((valueOrFunction) => {
        const value: T = getValueFromGetter(valueOrFunction);
        this.source.readyValue(value);
      })
    });
  }

  setValueOrFunction(value: Maybe<GetterOrValue<T>>) {
    this._valueOrFunctionOverride.next(value);
  }
}
