import { Directive, inject, input } from '@angular/core';
import { getValueFromGetter, Maybe, GetterOrValue } from '@dereekb/util';
import { filterMaybe } from '@dereekb/rxjs';
import { BehaviorSubject, combineLatest, map, Observable, shareReplay, switchMap } from 'rxjs';
import { cleanSubscription } from '../../../rxjs/subscription';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Directive that provides a default value when triggered.
 *
 * No value is required, allowing the directive to automatically call readyValue.
 *
 * The valueOrFunction will filter on null/undefined input and wait until the input value is non-null.
 *
 * Use a getter if null/undefined values should be passed to the action.
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
    cleanSubscription(
      this.valueOrFunction$.pipe(switchMap((valueOrFunction) => this.source.triggered$.pipe(map(() => valueOrFunction)))).subscribe((valueOrFunction) => {
        const value: T = getValueFromGetter(valueOrFunction);
        this.source.readyValue(value);
      })
    );
  }

  setValueOrFunction(value: Maybe<GetterOrValue<T>>) {
    this._valueOrFunctionOverride.next(value);
  }
}
