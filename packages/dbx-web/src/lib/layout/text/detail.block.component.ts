import { Component, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';

/**
 * Header and details offset with an icon.
 */
@Component({
  selector: 'dbx-detail-block',
  template: `
    <dbx-detail-block-header [icon]="icon" [header]="header">
      <ng-content select="[header]"></ng-content>
    </dbx-detail-block-header>
    <div class="dbx-detail-block-content">
      <ng-content></ng-content>
    </div>
  `,
  host: {
    class: 'dbx-detail-block d-block'
  }
})
export class DbxDetailBlockComponent {
  @Input()
  icon?: Maybe<string>;

  @Input()
  header?: Maybe<string>;
}
