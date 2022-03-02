import { Directive } from '@angular/core';
import { DbxPopoverComponent } from './popover.component';

/**
 * Abstract popover directive.
 */
@Directive()
export abstract class AbstractPopoverDirective<O = any, I = any, T = any> {

  constructor(public readonly popover: DbxPopoverComponent<O, I, T>) { }

  close(): void {
    this.popover.close();
  }

  returnAndClose(value: O): void {
    this.popover.return(value);
  }

}
