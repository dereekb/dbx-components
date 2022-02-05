import { Component, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { DbxBarColor } from './bar';

/**
 * Acts as a divider between content and centers a label within a background.
 */
@Component({
  selector: 'dbx-bar',
  template: `
  <div class="dbx-bar dbx-hint" [ngClass]="(color) ? ('dbx-bar-' + color) : ''">
    <mat-icon class="button-spacer" *ngIf="icon">{{ icon }}</mat-icon>
    <span *ngIf="text">{{ text }}</span>
  </div>`
})
export class DbxBarComponent {

  @Input()
  text?: Maybe<string>;

  @Input()
  icon?: Maybe<string>;

  @Input()
  color?: Maybe<DbxBarColor>;

}
