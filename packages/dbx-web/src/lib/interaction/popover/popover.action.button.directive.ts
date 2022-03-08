import { Directive, Host, NgZone } from '@angular/core';
import { DbxButtonDirective, DbxActionButtonDirective, DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';
import { DbxPopoverActionDirective } from './popover.action.directive';

/**
 * Action directive that is used to link an DbxButton to an DbxPopoverActionDirective.
 */
@Directive({
  selector: '[dbxPopoverActionButton]'
})
export class DbxPopoverActionButtonDirective extends DbxActionButtonDirective {

  constructor(
    @Host() button: DbxButtonDirective,
    source: DbxActionContextStoreSourceInstance,
    ngZone: NgZone,
    readonly appPopoverActionDirective: DbxPopoverActionDirective) {
    super(button, source, ngZone);
  }

  protected override _buttonClicked(): void {
    this.appPopoverActionDirective.showPopover();
  }

}
