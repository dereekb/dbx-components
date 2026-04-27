import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxSubSectionComponent } from '../../layout/section/subsection.component';

/**
 * Renders a styled prompt section with a header, descriptive text, and a hero content slot.
 *
 * @dbxWebComponent
 * @dbxWebSlug prompt
 * @dbxWebCategory overlay
 * @dbxWebRelated prompt-confirm, dialog-content
 * @dbxWebSkillRefs dbx__ref__dbx-app-structure
 * @dbxWebMinimalExample ```html
 * <dbx-prompt header="Confirm"></dbx-prompt>
 * ```
 *
 * @example
 * ```html
 * <dbx-prompt header="Delete account" prompt="This cannot be undone.">
 *   <button mat-button (click)="cancel()">Cancel</button>
 *   <button mat-flat-button color="warn" (click)="confirm()">Delete</button>
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
