
import { Component, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { DbxBarColor } from './bar';

/**
 * Acts as a wrapper for content distributed along a bar.
 */
@Component({
  selector: 'dbx-bar',
  template: `<ng-content></ng-content>`,
  host: {
    'class': 'dbx-bar',
    '[class.dbx-primary-bg]': 'color === "primary"',
    '[class.dbx-accent-bg]': 'color === "accent"',
    '[class.dbx-warn-bg]': 'color === "warn"'
  }
})
export class DbxBarComponent {

  @Input()
  color?: Maybe<DbxBarColor>;

}
