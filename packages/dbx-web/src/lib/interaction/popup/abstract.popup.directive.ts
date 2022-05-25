import { Directive } from '@angular/core';
import { DbxPopupComponent } from './popup.component';

/**
 * Abstract popup directive.
 */
@Directive()
export abstract class AbstractPopupDirective<O = unknown, I = unknown, T = unknown> {

  constructor(public readonly popup: DbxPopupComponent<O, I, T>) { }

  closePopup(): void {
    this.popup.close();
  }

}
