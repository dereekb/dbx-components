import { Directive, Input } from '@angular/core';
import { DbxThemeColor, dbxColorBackground } from './style';
import { type Maybe } from '@dereekb/util';

/**
 * Used to apply a background style using a color.
 */
@Directive({
  selector: '[dbxColor]',
  host: {
    '[class]': 'cssClass'
  }
})
export class DbxColorDirective {
  cssClass = '';

  @Input()
  set dbxColor(dbxColor: Maybe<DbxThemeColor | ''>) {
    this.cssClass = dbxColorBackground(dbxColor);
  }
}
