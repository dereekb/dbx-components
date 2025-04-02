import { Directive, Input, OnInit, OnDestroy, inject, input } from '@angular/core';
import { getValueFromGetter, Maybe, GetterOrValue } from '@dereekb/util';
import { filterMaybe } from '@dereekb/rxjs';
import { BehaviorSubject, shareReplay, switchMap, tap } from 'rxjs';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * Directive that provides a default value when triggered.
 *
 * No value is required, allowing the directive to automatically call readyValue.
 */
@Directive({
  selector: '[dbxActionValue]',
  standalone: true
})
export class DbxActionValueDirective<T, O> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  readonly valueOrFunction = input<Maybe<GetterOrValue<T>>>(undefined, { alias: 'dbxActionValue' });

  readonly source = inject(DbxActionContextStoreSourceInstance<T, O>, { host: true });

  private readonly _valueOrFunction = new BehaviorSubject<Maybe<GetterOrValue<T>>>(undefined);
  readonly valueOrFunction$ = this._valueOrFunction.pipe(filterMaybe(), shareReplay(1));

  constructor() {
    super();
  }

  ngOnInit(): void {
    this.sub = this.valueOrFunction$
      .pipe(
        switchMap((valueOrFunction) =>
          this.source.triggered$.pipe(
            tap(() => {
              const value: T = getValueFromGetter(valueOrFunction);
              this.source.readyValue(value);
            })
          )
        )
      )
      .subscribe();
  }

  override ngOnDestroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      super.ngOnDestroy();
      this._valueOrFunction.complete();
    });
  }
}
