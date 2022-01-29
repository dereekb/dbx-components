import { Directive } from '@angular/core';
import { DbNgxPopoverComponent } from './popover.component';

/**
 * Abstract popover directive.
 */
@Directive()
export abstract class AbstractPopoverDirective<I = any, O = any, T = any> {

  constructor(public readonly popover: DbNgxPopoverComponent<I, O, T>) { }

  closePopover(): void {
    this.popover.close();
  }

  returnAndClosePopover(value: O): void {
    this.popover.return(value);
  }

}
