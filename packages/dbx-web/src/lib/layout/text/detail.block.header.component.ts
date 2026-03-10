import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { type Maybe } from '@dereekb/util';

/**
 * Header row for a detail block, displaying an optional icon and label with projected content.
 *
 * Used internally by {@link DbxDetailBlockComponent} but can also be used standalone.
 *
 * @example
 * ```html
 * <dbx-detail-block-header icon="email" header="Contact">
 *   <button mat-button>Edit</button>
 * </dbx-detail-block-header>
 * ```
 */
@Component({
  selector: 'dbx-detail-block-header',
  template: `
    @if (icon()) {
      <mat-icon>{{ icon() }}</mat-icon>
    }
    @if (header()) {
      <span class="dbx-detail-block-header-label">{{ header() }}</span>
    }
    @if (alignHeader()) {
      <div class="dbx-flex dbx-w100">
        <span class="dbx-spacer"></span>
        <ng-template *ngTemplateOutlet="content"></ng-template>
      </div>
    } @else {
      <ng-template *ngTemplateOutlet="content"></ng-template>
    }
    <ng-template #content>
      <ng-content></ng-content>
    </ng-template>
  `,
  host: {
    class: 'dbx-detail-block-header',
    '[class]': '{ "dbx-detail-block-header-no-icon": !icon(), "dbx-detail-block-header-align": alignHeader() }'
  },
  imports: [MatIconModule, NgTemplateOutlet],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxDetailBlockHeaderComponent {
  readonly icon = input<Maybe<string>>();
  readonly header = input<Maybe<string>>();
  readonly alignHeader = input<boolean>(false);
}
