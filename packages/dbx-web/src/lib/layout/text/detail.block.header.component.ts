import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { type Maybe } from '@dereekb/util';

@Component({
  selector: 'dbx-detail-block-header',
  template: `
    @if (icon) {
      <mat-icon>{{ icon }}</mat-icon>
    }
    @if (header) {
      <span class="dbx-detail-block-header-label">{{ header }}</span>
    }
    <ng-content></ng-content>
  `,
  host: {
    class: 'dbx-detail-block-header',
    '[class]': '{ "dbx-detail-block-header-no-icon": !icon }'
  },
  imports: [MatIcon],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxDetailBlockHeaderComponent {
  @Input()
  icon?: Maybe<string>;

  @Input()
  header?: Maybe<string>;
}
