import { Directive, Input } from '@angular/core';
import { DbxThemeColor } from '../style/style';

/**
 * Section used to wrap content in a border with internal padding.
 */
@Directive({
  selector: 'dbx-content-border,[dbxContentBorder]',
  host: {
    class: 'd-block dbx-content-border',
    '[class]': `"dbx-content-border-" + color`
  }
})
export class DbxContentBorderDirective {
  @Input()
  color: DbxThemeColor = 'background';
}
