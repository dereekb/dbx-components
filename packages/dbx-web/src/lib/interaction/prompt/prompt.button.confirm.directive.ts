import { DbNgxButtonDirective, DbNgxButtonInterceptor } from '@dereekb/dbx-core';
import { Directive, Host, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { DbNgxPromptConfirm } from './prompt.confirm';
import { map } from 'rxjs/operators';

/**
 * Directive that binds together a confirm dialog with the button.
 */
@Directive({
  selector: '[dbxPromptConfirmButton]',
})
export class DbNgxPromptConfirmButtonDirective implements OnInit, DbNgxButtonInterceptor {

  readonly interceptButtonClick: () => Observable<boolean> = () => {
    return this.prompt.showDialog().pipe(map(x => Boolean(x)));
  }

  constructor(
    @Host() readonly appButton: DbNgxButtonDirective,
    @Host() readonly prompt: DbNgxPromptConfirm
  ) { }

  ngOnInit(): void {
    this.appButton.setButtonInterceptor(this);
  }

}
