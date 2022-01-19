import { Directive, EventEmitter, Host, Output, OnInit } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/ngx-core';
import { DbNgxFormlyContext } from './formly.context';

/**
 * Used to see form value changes.
 */
@Directive({
  selector: '[dbxFormValueChange]'
})
export class DbNgxFormValueChangesDirective<T extends object = any> extends AbstractSubscriptionDirective implements OnInit {

  @Output()
  readonly dbxFormValueChange = new EventEmitter<T>();

  constructor(@Host() public readonly context: DbNgxFormlyContext<T>) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.context.stream$.subscribe((x) => {
      this.dbxFormValueChange.next(this.context.value);
    });
  }

}
