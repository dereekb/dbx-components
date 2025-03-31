import { computed, Directive, input, Input } from '@angular/core';
import { DbxThemeColor } from '../style/style';

/**
 * Section used to wrap content in a border with internal padding.
 */
@Directive({
  selector: 'dbx-content-border,[dbxContentBorder]',
  host: {
    class: 'd-block dbx-content-border',
    '[class]': `classConfig()`
  },
  standalone: true
})
export class DbxContentBorderDirective {
  readonly color = input<DbxThemeColor>('background');
  readonly classConfig = computed(() => `dbx-content-border-${this.color()}`);
}
