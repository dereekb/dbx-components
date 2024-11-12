import { Directive, inject } from '@angular/core';
import { DbxPopoverComponent } from './popover.component';

/**
 * Abstract popover directive.
 */
@Directive()
export abstract class AbstractPopoverDirective<O = unknown, I = unknown, T = unknown> {
  readonly popover = inject(DbxPopoverComponent<O, I, T>);

  close(): void {
    this.popover.close();
  }

  returnAndClose(value: O): void {
    this.popover.return(value);
  }
}
