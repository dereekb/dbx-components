import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxDetailBlockHeaderComponent } from './detail.block.header.component';

/**
 * Header and details offset with an icon.
 */
@Component({
  selector: 'dbx-detail-block',
  template: `
    <dbx-detail-block-header [icon]="icon()" [header]="header()">
      <ng-content select="[header]"></ng-content>
    </dbx-detail-block-header>
    <div class="dbx-detail-block-content">
      <ng-content></ng-content>
    </div>
  `,
  host: {
    class: 'dbx-detail-block d-block'
  },
  imports: [DbxDetailBlockHeaderComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxDetailBlockComponent {
  readonly icon = input<Maybe<string>>();
  readonly header = input<Maybe<string>>();
}
