import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { type ThemePalette } from '@angular/material/core';
import { DbxFlagComponent } from './flag.component';
import { type Maybe } from '@dereekb/util';

/**
 * A themed banner with a text prompt and a slot for action content (e.g., buttons).
 *
 * Built on {@link DbxFlagComponent}, this is convenient for call-to-action banners.
 *
 * @example
 * ```html
 * <dbx-flag-prompt text="Complete your profile" color="accent">
 *   <button mat-button>Go</button>
 * </dbx-flag-prompt>
 * ```
 */
@Component({
  selector: 'dbx-flag-prompt',
  template: `
    <dbx-flag [color]="color()">
      <span class="dbx-flag-prompt">{{ text() }}</span>
      <span class="dbx-flag-spacer"></span>
      <ng-content></ng-content>
    </dbx-flag>
  `,
  imports: [DbxFlagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFlagPromptComponent {
  readonly color = input<ThemePalette>('accent');
  readonly text = input<Maybe<string>>();
}
