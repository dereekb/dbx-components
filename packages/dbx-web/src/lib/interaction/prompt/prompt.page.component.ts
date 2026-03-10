import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxContentContainerDirective } from '../../layout/content/content.container.directive';

/**
 * Full-page prompt layout that centers content within a growing content container.
 *
 * @example
 * ```html
 * <dbx-prompt-page>
 *   <dbx-prompt [header]="'Welcome'" [prompt]="'Please sign in.'"></dbx-prompt>
 * </dbx-prompt-page>
 * ```
 */
@Component({
  selector: 'dbx-prompt-page',
  template: `
    <dbx-content-container grow="full">
      <div class="dbx-prompt-page-content-wrap">
        <ng-content></ng-content>
      </div>
    </dbx-content-container>
  `,
  host: {
    class: 'd-block dbx-prompt-page'
  },
  imports: [DbxContentContainerDirective],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxPromptPageComponent {}
