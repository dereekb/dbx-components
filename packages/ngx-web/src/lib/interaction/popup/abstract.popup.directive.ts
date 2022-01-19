import { Directive } from '@angular/core';
import { DbNgxPopupComponent } from './popup.component';

/**
 * Abstract popup directive.
 */
@Directive()
export abstract class AbstractPopupDirective<I = any, O = any, T = any> {

  constructor(public readonly popup: DbNgxPopupComponent<I, O, T>) { }

  closePopup(): void {
    this.popup.close();
  }

}
