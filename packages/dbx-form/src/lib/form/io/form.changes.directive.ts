import { Directive, OnInit, OnDestroy, inject, output } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { first, mergeMap, delay, map } from 'rxjs';
import { DbxForm } from '../form';

/**
 * Used to see form value changes.
 *
 * Emits undefined when the form is incomplete, and the value when the form is complete.
 */
@Directive({
  selector: '[dbxFormValueChange]',
  standalone: true
})
export class DbxFormValueChangesDirective<T> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  readonly form = inject(DbxForm<T>, { host: true });
  readonly dbxFormValueChange = output<Maybe<T>>();

  ngOnInit(): void {
    this.sub = this.form.stream$
      .pipe(
        mergeMap((x) =>
          this.form.getValue().pipe(
            first(),
            map((value) => ({ isComplete: x.isComplete, value }))
          )
        ),
        delay(0)
      )
      .subscribe(({ isComplete, value }) => {
        if (isComplete) {
          this.dbxFormValueChange.emit(value);
        } else {
          this.dbxFormValueChange.emit(undefined);
        }
      });
  }
}
