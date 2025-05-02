import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { type Maybe } from '@dereekb/util';

@Component({
  selector: 'dbx-detail-block-header',
  template: `
    @if (icon()) {
      <mat-icon>{{ icon() }}</mat-icon>
    }
    @if (header()) {
      <span class="dbx-detail-block-header-label">{{ header() }}</span>
    }
    <ng-content></ng-content>
  `,
  host: {
    class: 'dbx-detail-block-header',
    '[class]': '{ "dbx-detail-block-header-no-icon": !icon() }'
  },
  imports: [MatIconModule],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxDetailBlockHeaderComponent {
  readonly icon = input<Maybe<string>>();
  readonly header = input<Maybe<string>>();
}
