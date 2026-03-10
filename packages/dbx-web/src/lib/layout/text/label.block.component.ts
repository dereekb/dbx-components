import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Displays a label header above projected content, useful for labeling form fields or data sections.
 *
 * @example
 * ```html
 * <dbx-label-block header="Email">
 *   <span>user@example.com</span>
 * </dbx-label-block>
 * ```
 */
@Component({
  selector: 'dbx-label-block',
  template: `
    <span class="d-block dbx-label dbx-label-padded">{{ header() }}</span>
    <ng-content></ng-content>
  `,
  host: {
    class: 'dbx-label-block'
  },
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxLabelBlockComponent {
  readonly header = input<Maybe<string>>();
}
