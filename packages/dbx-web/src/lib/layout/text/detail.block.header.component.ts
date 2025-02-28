import { Component, Input } from '@angular/core';
import { type Maybe } from '@dereekb/util';

@Component({
  selector: 'dbx-detail-block-header',
  template: `
    <mat-icon *ngIf="icon">{{ icon }}</mat-icon>
    <span *ngIf="header" class="dbx-detail-block-header-label">{{ header }}</span>
    <ng-content></ng-content>
  `,
  host: {
    class: 'dbx-detail-block-header',
    '[class]': '{ "dbx-detail-block-header-no-icon": !icon }'
  }
})
export class DbxDetailBlockHeaderComponent {
  @Input()
  icon?: Maybe<string>;

  @Input()
  header?: Maybe<string>;
}
