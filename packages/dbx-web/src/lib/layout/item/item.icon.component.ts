import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { MatIconModule } from '@angular/material/icon';

/**
 * Section piece that puts an icon on the left, and arbitrary content on the right with a header.
 */
@Component({
  selector: 'dbx-icon-item',
  template: `
    <div class="dbx-icon-item">
      @if (icon()) {
        <div class="left">
          <mat-icon>{{ icon() }}</mat-icon>
        </div>
      }
      <div class="right">
        @if (header()) {
          <h3 class="dbx-icon-item-header">{{ header() }}</h3>
        }
        <div class="right-content">
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `,
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxIconItemComponent {
  readonly icon = input<Maybe<string>>();
  readonly header = input<Maybe<string>>();
}
