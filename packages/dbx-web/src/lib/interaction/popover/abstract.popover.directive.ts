import { Directive, inject } from '@angular/core';
import { DbxPopoverComponent } from './popover.component';

/**
 * Abstract base directive for components rendered inside a popover, providing access to close and return operations.
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
