import { Directive, Host, Input, OnInit } from '@angular/core';
import { getValueFromObjectOrGetter, ObjectOrGetter } from '@dereekb/util';
import { AbstractSubscriptionDirective } from '../subscription';
import { ActionContextStoreSourceInstance } from './action';

/**
 * Directive that provides a default value when triggered.
 *
 * No value is required, allowing the directive to automatically call readyValue with undefined.
 */
@Directive({
  selector: '[dbxActionValue]',
})
export class DbNgxActionValueDirective<T, O> extends AbstractSubscriptionDirective implements OnInit {

  @Input('dbxActionValue')
  valueOrFunction?: ObjectOrGetter<T>;

  constructor(@Host() public readonly source: ActionContextStoreSourceInstance<T, O>) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.source.triggered$.subscribe(() => {
      const value = getValueFromObjectOrGetter(this.valueOrFunction);
      this.source.readyValue(value as T);
    });
  }

}
