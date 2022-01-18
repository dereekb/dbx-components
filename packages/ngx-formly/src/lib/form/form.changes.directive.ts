import { Directive, EventEmitter, Host, Input, Output, OnInit } from '@angular/core';
import { AbstractSubscriptionDirective } from '../utility';
import { FormComponent, FormComponentState } from './form.component';
import { SubscriptionObject } from '@gae-web/appengine-utility';
import { DbNgxFormlyContext } from './formly.context';

/**
 * Used to see form value changes.
 */
@Directive({
  selector: '[dbxFormValueChange]'
})
export class DbNgxFormValueChangesDirective<T extends object = any> extends AbstractSubscriptionDirective implements OnInit {

  @Output()
  readonly appFormValueChange = new EventEmitter<T>();

  constructor(@Host() public readonly context: DbNgxFormlyContext<T>) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.context.stream$.subscribe((x) => {
      this.appFormValueChange.next(this.context.value);
    });
  }

}
