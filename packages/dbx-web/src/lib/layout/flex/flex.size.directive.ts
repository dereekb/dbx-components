
import { Input, Directive } from '@angular/core';
import { DbxFlexSize } from './flex';

/**
 * Applies the proper dbx-flex size class based on the input.
 */
@Directive({
  selector: '[dbxFlexSize]',
  host: {
    '[class]': '"dbx-flex-" + size'
  }
})
export class DbxFlexSizeDirective {

  @Input('dbxFlexSize')
  size: DbxFlexSize = 1;

}
