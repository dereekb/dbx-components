import { DbxButton, DbxButtonInterceptor } from '@dereekb/dbx-core';
import { Directive, OnInit, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DbxPromptConfirm } from './prompt.confirm';

/**
 * Directive that binds together a confirm dialog with the button.
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
