import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DbxBarColor } from './bar';
import { MatIconModule } from '@angular/material/icon';
import { DbxBarDirective } from './bar.directive';

/**
 * A themed header bar displaying an optional icon and text label, useful as a section divider.
 *
 * @example
 * ```html
 * <dbx-bar-header icon="info" text="Section Title" color="accent"></dbx-bar-header>
 * ```
 */
@Component({
  selector: 'dbx-bar-header',
  template: `
    <dbx-bar [color]="color()">
      @if (icon()) {
        <mat-icon class="button-spacer">{{ icon() }}</mat-icon>
      }
      @if (text()) {
        <span>{{ text() }}</span>
      }
      <ng-content></ng-content>
    </dbx-bar>
  `,
  host: {
    class: 'dbx-bar-header dbx-hint'
  },
  imports: [DbxBarDirective, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxBarHeaderComponent {
  readonly text = input<Maybe<string>>();
  readonly icon = input<Maybe<string>>();
  readonly color = input<Maybe<DbxBarColor>>();
}
