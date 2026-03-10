import { Directive, inject } from '@angular/core';
import { DbxPopupComponent } from './popup.component';

/**
 * Abstract base directive for components rendered inside a popup, providing access to the popup's close operation.
 */
@Directive()
export abstract class AbstractPopupDirective<O = unknown, I = unknown, T = unknown> {
  readonly popup = inject(DbxPopupComponent<O, I, T>);

  closePopup(): void {
    this.popup.close();
  }
}
