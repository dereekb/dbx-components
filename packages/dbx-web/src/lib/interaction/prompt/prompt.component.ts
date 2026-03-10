import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxSubSectionComponent } from '../../layout/section/subsection.component';

/**
 * Renders a styled prompt section with a header, descriptive text, and a hero content slot.
 *
 * @example
 * ```html
 * <dbx-prompt [header]="'Welcome'" [prompt]="'Please sign in to continue.'">
 *   <img hero src="logo.png" />
 *   <button mat-raised-button>Sign In</button>
 * </dbx-prompt>
 * ```
 */
@Component({
  selector: 'dbx-prompt',
  template: `
    <div class="dbx-prompt">
      <ng-content select="[hero]"></ng-content>
      <dbx-subsection [header]="header()" [hint]="prompt()">
        <ng-content></ng-content>
      </dbx-subsection>
    </div>
  `,
  standalone: true,
  imports: [DbxSubSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxPromptComponent {
  readonly header = input<Maybe<string>>();
  readonly prompt = input<Maybe<string>>();
}
