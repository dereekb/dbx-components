import { Directive, EventEmitter, Host, Output, OnInit } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxForm } from '../form';

/**
 * Used to see form value changes.
 */
@Directive({
  selector: '[dbxFormValueChange]'
})
export class DbxFormValueChangesDirective<T extends object = any> extends AbstractSubscriptionDirective implements OnInit {

  @Output()
  readonly dbxFormValueChange = new EventEmitter<T>();

  constructor(@Host() public readonly form: DbxForm) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.form.stream$.subscribe((x) => {
      this.dbxFormValueChange.next(this.form.value);
    });
  }

}
