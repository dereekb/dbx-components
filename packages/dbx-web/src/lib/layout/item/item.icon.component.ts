import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { MatIconModule } from '@angular/material/icon';

/**
 * Displays an icon on the left with a header and projected content on the right.
 *
 * Useful for building descriptive list items or info rows where each entry is identified by a Material icon.
 *
 * @example
 * ```html
 * <dbx-icon-item [icon]="'email'" [header]="'Contact'">
 *   <a href="mailto:hello@example.com">hello@example.com</a>
 * </dbx-icon-item>
 * ```
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
