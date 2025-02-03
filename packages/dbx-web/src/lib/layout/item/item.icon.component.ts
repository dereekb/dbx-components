import { Component, Input } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Section piece that puts an icon on the left, and arbitrary content on the right with a header.
 */
@Component({
  selector: 'dbx-icon-item',
  template: `
    <div class="dbx-icon-item">
      <div class="left" *ngIf="icon">
        <mat-icon>{{ icon }}</mat-icon>
      </div>
      <div class="right">
        <h3 *ngIf="header" class="dbx-icon-item-header">{{ header }}</h3>
        <div class="right-content">
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `
})
export class DbxIconItemComponent {
  @Input()
  icon?: Maybe<string>;

  @Input()
  header?: Maybe<string>;
}
