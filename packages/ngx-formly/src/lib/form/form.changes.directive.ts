import { Directive, EventEmitter, Host, Output, OnInit } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/ngx-core';
import { DbNgxForm } from '.';
import { DbNgxFormlyContext } from '../formly/formly.context';

/**
 * Used to see form value changes.
 */
@Directive({
  selector: '[dbxFormValueChange]'
})
export class DbNgxFormValueChangesDirective<T extends object = any> extends AbstractSubscriptionDirective implements OnInit {

  @Output()
  readonly dbxFormValueChange = new EventEmitter<T>();

  constructor(@Host() public readonly form: DbNgxForm) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.form.stream$.subscribe((x) => {
      this.dbxFormValueChange.next(this.form.value);
    });
  }

}
