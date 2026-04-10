import { Directive, type OnInit, inject, output } from '@angular/core';
import { cleanSubscription } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { first, switchMap, delay, map, of } from 'rxjs';
import { DbxForm } from '../form';

/**
 * Directive that observes form value changes and emits the current value when the form is complete/valid,
 * or `undefined` when the form is incomplete.
 *
 * Subscribes to the form's stream during `ngOnInit` to ensure the first emission occurs after initialization.
 *
 * @selector `[dbxFormValueChange]`
 *
 * @typeParam T - The form value type.
 */
@Directive({
  selector: '[dbxFormValueChange]',
  standalone: true
})
export class DbxFormValueChangeDirective<T> implements OnInit {
  readonly form = inject(DbxForm<T>, { host: true });

  /**
   * Emits the current form value when the form is complete/valid, or `undefined` when incomplete.
   */
  readonly dbxFormValueChange = output<Maybe<T>>();

  protected readonly _sub = cleanSubscription();

  ngOnInit(): void {
    // specifically call within ngOnInit to ensure first emission occurs after the form is initialized.
    this._sub.setSub(
      this.form.stream$
        .pipe(
          switchMap((x) => {
            if (!x.isComplete) {
              return of({ isComplete: false as const, value: undefined as Maybe<T> });
            }

            return this.form.getValue().pipe(
              first(),
              map((value) => ({ isComplete: true as const, value: value as Maybe<T> }))
            );
          }),
          delay(0)
        )
        .subscribe(({ isComplete, value }) => {
          if (isComplete) {
            this.dbxFormValueChange.emit(value);
          } else {
            this.dbxFormValueChange.emit(undefined);
          }
        })
    );
  }
}
