import { Directive } from '@angular/core';
import { DbxPopupComponent } from './popup.component';

/**
 * Abstract popup directive.
 */
@Directive()
export abstract class AbstractPopupDirective<I = any, O = any, T = any> {

  constructor(public readonly popup: DbxPopupComponent<I, O, T>) { }

  closePopup(): void {
    this.popup.close();
  }

}
