import { Directive, Host, NgZone } from '@angular/core';
import { DbNgxButtonDirective, DbNgxActionButtonDirective, ActionContextStoreSourceInstance } from '@dereekb/ngx-core';
import { DbNgxPopoverActionDirective } from './popover.action.directive';

/**
 * Action directive that is used to link an DbNgxButton to an DbNgxPopoverActionDirective.
 */
@Directive({
  selector: '[dbxPopoverActionButton]'
})
export class DbNgxPopoverActionButtonDirective extends DbNgxActionButtonDirective {

  constructor(
    @Host() button: DbNgxButtonDirective,
    source: ActionContextStoreSourceInstance,
    ngZone: NgZone,
    readonly appPopoverActionDirective: DbNgxPopoverActionDirective) {
    super(button, source, ngZone);
  }

  protected override _buttonClicked(): void {
    this.appPopoverActionDirective.showPopover();
  }

}
