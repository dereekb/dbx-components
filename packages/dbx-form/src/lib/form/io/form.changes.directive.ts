import { Directive, EventEmitter, Host, Output, OnInit } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { filter, first, mergeMap, delay } from 'rxjs';
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
    this.sub = this.form.stream$.pipe(
      filter(x => x.isComplete),
      mergeMap(() => this.form.getValue().pipe(first())),
      delay(0)
    ).subscribe((value) => {
      this.dbxFormValueChange.next(value);
    });
  }

}
