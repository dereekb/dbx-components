import { Directive, inject } from '@angular/core';
import { DbxPopupComponent } from './popup.component';

/**
 * Abstract popup directive.
 */
@Directive()
export abstract class AbstractPopupDirective<O = unknown, I = unknown, T = unknown> {
  readonly popup = inject(DbxPopupComponent<O, I, T>);

  closePopup(): void {
    this.popup.close();
  }
}
