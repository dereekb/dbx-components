import { DbNgxButtonInterceptor } from './../../button/button.directive';
import { Directive, Host, Input, OnInit } from '@angular/core';
import { DbNgxButtonDirective } from '../../button/button.directive';
import { Observable, of } from 'rxjs';
import { AbstractPromptConfirmDirective } from './prompt.confirm.directive';
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
