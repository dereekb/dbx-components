import { Component, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { DbxBarColor } from './bar';

/**
 * Acts as a divider between content and centers a label within a background.
 */
@Component({
  selector: 'dbx-bar',
  template: `
    <mat-icon class="button-spacer" *ngIf="icon">{{ icon }}</mat-icon>
    <span *ngIf="text">{{ text }}</span>
    `,
  host: {
    'class': 'dbx-bar dbx-hint',
    '[class.dbx-bar-primary]': 'color === "primary"',
    '[class.dbx-bar-accent]': 'color === "accent"'
  }
})
export class DbxBarComponent {

  @Input()
  text?: Maybe<string>;

  @Input()
  icon?: Maybe<string>;

  @Input()
  color?: Maybe<DbxBarColor>;

}
