import { Component, Input } from '@angular/core';
import { ThemePalette } from '@angular/material/core';

/**
 * Pre-configured dbx-flag prompt to do something.
 */
@Component({
  selector: 'dbx-flag-prompt',
  template: `
    <dbx-flag [color]="color">
      <span class="dbx-flag-prompt">{{ text }}</span>
      <span class="dbx-flag-spacer"></span>
      <ng-content></ng-content>
    </dbx-flag>
  `
  // TODO: styleUrls: ['./container.scss']
})
export class DbxFlagPromptComponent {
  @Input()
  color: ThemePalette = 'accent';

  @Input()
  text?: string;
}
