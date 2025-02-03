import { Component, Input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxBarColor } from './bar';

/**
 * Acts as a divider between content and centers a label within a background.
 */
@Component({
  selector: 'dbx-bar-header',
  template: `
    <dbx-bar [color]="color">
      <mat-icon class="button-spacer" *ngIf="icon">{{ icon }}</mat-icon>
      <span *ngIf="text">{{ text }}</span>
      <ng-content></ng-content>
    </dbx-bar>
  `,
  host: {
    class: 'dbx-bar-header dbx-hint'
  }
})
export class DbxBarHeaderComponent {
  @Input()
  text?: Maybe<string>;

  @Input()
  icon?: Maybe<string>;

  @Input()
  color?: Maybe<DbxBarColor>;
}
