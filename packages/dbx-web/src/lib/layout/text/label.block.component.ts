import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Displays a label header above projected content, useful for labeling form fields or data sections.
 *
 * @dbxWebComponent
 * @dbxWebSlug label-block
 * @dbxWebCategory text
 * @dbxWebRelated detail-block
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-label-block header="Label">Body</dbx-label-block>
 * ```
 *
 * @example
 * ```html
 * <dbx-label-block header="Status"><span>Active</span></dbx-label-block>
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
