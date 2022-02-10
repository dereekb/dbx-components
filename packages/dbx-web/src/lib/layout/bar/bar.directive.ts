
import { Component, Input, Directive } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { DbxBarColor } from './bar';

/**
 * Acts as a wrapper for content distributed along a bar.
 */
@Directive({
  selector: 'dbx-bar',
  host: {
    'class': 'dbx-bar',
    '[class.dbx-primary-bg]': 'color === "primary"',
    '[class.dbx-accent-bg]': 'color === "accent"',
    '[class.dbx-warn-bg]': 'color === "warn"'
  }
})
export class DbxBarDirective {

  @Input()
  color?: Maybe<DbxBarColor>;

}
