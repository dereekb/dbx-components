import { DbNgxButtonDirective, DbNgxButtonInterceptor } from '@dereekb/ngx-core';
import { Directive, Host, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { DbNgxPromptConfirm } from './prompt.confirm';

/**
 * Directive that binds together a confirm dialog with the button.
 */
@Directive({
  selector: '[dbxPromptConfirmButton]',
})
export class DbNgxPromptConfirmButtonDirective implements OnInit, DbNgxButtonInterceptor {

  readonly interceptButtonClick: () => Observable<boolean> = () => {
    return this.prompt.showDialog();
  }

  constructor(
    @Host() readonly appButton: DbNgxButtonDirective,
    @Host() readonly prompt: DbNgxPromptConfirm
  ) { }

  ngOnInit(): void {
    this.appButton.setButtonInterceptor(this);
  }

}
