import { DbxButton, type DbxButtonInterceptor } from '@dereekb/dbx-core';
import { Directive, type OnInit, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { DbxPromptConfirm } from './prompt.confirm';

/**
 * Intercepts button clicks to show a confirmation dialog before proceeding.
 *
 * Requires both a {@link DbxButton} and a {@link DbxPromptConfirm} on the host element.
 *
 * @example
 * ```html
 * <dbx-button [dbxPromptConfirm]="{ title: 'Are you sure?' }" dbxPromptConfirmButton text="Delete"></dbx-button>
 * ```
 */
@Directive({
  selector: '[dbxPromptConfirmButton]',
  standalone: true
})
export class DbxPromptConfirmButtonDirective implements OnInit, DbxButtonInterceptor {
  readonly button = inject(DbxButton, { host: true });
  readonly prompt = inject(DbxPromptConfirm, { host: true });

  readonly interceptButtonClick: () => Observable<boolean> = () => {
    return this.prompt.showDialog().pipe(map((x) => Boolean(x)));
  };

  ngOnInit(): void {
    this.button.setButtonInterceptor(this);
  }
}
