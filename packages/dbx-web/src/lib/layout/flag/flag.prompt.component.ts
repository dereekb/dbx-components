import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { DbxFlagComponent } from './flag.component';
import { Maybe } from '@dereekb/util';

/**
 * Pre-configured dbx-flag prompt to do something.
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
