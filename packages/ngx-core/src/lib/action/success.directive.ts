import { Directive, Host, Input, OnInit } from '@angular/core';
import { AbstractSubscriptionDirective } from '../subscription';
import { ActionContextStoreSourceInstance } from './action';

/**
 * Performs the action on success.
 */
export type SuccessActionFunction<O> = (value: O) => void;

/**
 * Directive that executes a function on ActionContextStore Success.
 */
@Directive({
  selector: '[dbxActionSuccess]',
})
export class DbNgxActionSuccessDirective<T, O> extends AbstractSubscriptionDirective implements OnInit {

  @Input('dbxActionSuccess')
  successFunction: SuccessActionFunction<O>;

  constructor(@Host() public readonly source: ActionContextStoreSourceInstance) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.source.success$.subscribe((result: O) => {
      this.successFunction(result);
    });
  }

}
