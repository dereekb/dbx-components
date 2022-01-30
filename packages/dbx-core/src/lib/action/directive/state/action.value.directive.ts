import { Directive, Host, Input, OnInit } from '@angular/core';
import { getValueFromObjectOrGetter, Maybe, ObjectOrGetter } from '@dereekb/util';
import { filterMaybe } from '@dereekb/rxjs';
import { BehaviorSubject } from 'rxjs';
import { shareReplay, switchMap, tap } from 'rxjs/operators';
import { AbstractSubscriptionDirective } from '../../../subscription';
import { ActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * Directive that provides a default value when triggered.
 *
 * No value is required, allowing the directive to automatically call readyValue with undefined.
 */
@Directive({
  selector: '[dbxActionValue]',
})
export class DbxActionValueDirective<T, O> extends AbstractSubscriptionDirective implements OnInit {

  private _valueOrFunction = new BehaviorSubject<Maybe<ObjectOrGetter<T>>>(undefined);
  readonly valueOrFunction$ = this._valueOrFunction.pipe(filterMaybe(), shareReplay(1));

  @Input('dbxActionValue')
  get valueOrFunction(): Maybe<ObjectOrGetter<T>> {
    return this._valueOrFunction.value;
  }

  set valueOrFunction(valueOrFunction: Maybe<ObjectOrGetter<T>>) {
    this._valueOrFunction.next(valueOrFunction);
  }

  constructor(@Host() public readonly source: ActionContextStoreSourceInstance<T, O>) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.valueOrFunction$.pipe(
      switchMap(valueOrFunction => this.source.triggered$.pipe(
        tap(() => {
          const value: T = getValueFromObjectOrGetter(valueOrFunction);
          this.source.readyValue(value);
        })
      ))
    ).subscribe();
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._valueOrFunction.complete();
  }

}
