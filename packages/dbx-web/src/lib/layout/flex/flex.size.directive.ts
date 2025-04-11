import { Input, Directive, input, computed } from '@angular/core';
import { DbxFlexSize } from './flex';

/**
 * Applies the proper dbx-flex size class based on the input.
 */
@Directive({
  selector: '[dbxFlexSize]',
  host: {
    '[class]': 'cssClassSignal()'
  },
  standalone: true
})
export class DbxFlexSizeDirective {

  readonly dbxFlexSize = input.required<DbxFlexSize>();
  readonly cssClassSignal = computed(() => `dbx-flex-${this.dbxFlexSize()}`);

}
