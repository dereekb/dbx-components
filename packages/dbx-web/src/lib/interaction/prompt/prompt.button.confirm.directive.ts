import { DbxButtonDirective, DbxButtonInterceptor } from '@dereekb/dbx-core';
import { Directive, Host, OnInit } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DbxPromptConfirm } from './prompt.confirm';

/**
 * Directive that binds together a confirm dialog with the button.
 */
@Directive({
  selector: '[dbxPromptConfirmButton]',
})
export class DbxPromptConfirmButtonDirective implements OnInit, DbxButtonInterceptor {

  readonly interceptButtonClick: () => Observable<boolean> = () => {
    return this.prompt.showDialog().pipe(map(x => Boolean(x)));
  }

  constructor(
    @Host() readonly appButton: DbxButtonDirective,
    @Host() readonly prompt: DbxPromptConfirm
  ) { }

  ngOnInit(): void {
    this.appButton.setButtonInterceptor(this);
  }

}
