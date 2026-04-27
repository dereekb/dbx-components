import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxDetailBlockHeaderComponent } from './detail.block.header.component';

/**
 * A structured content block with a header row (icon + label) and a detail content area below.
 *
 * Use the `[header]` content slot for extra header-level content and default content for the detail area.
 *
 * @dbxWebComponent
 * @dbxWebSlug detail-block
 * @dbxWebCategory text
 * @dbxWebRelated label-block
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-detail-block header="Label">Body</dbx-detail-block>
 * ```
 *
 * @example
 * ```html
 * <dbx-detail-block header="Email" icon="mail">
 *   <p>{{ user.email }}</p>
 * </dbx-detail-block>
 * ```
 */
@Component({
  selector: 'dbx-detail-block',
  template: `
    <dbx-detail-block-header [icon]="icon()" [header]="header()" [alignHeader]="alignHeader()">
      <ng-content select="[header]"></ng-content>
    </dbx-detail-block-header>
    <div class="dbx-detail-block-content">
      <ng-content></ng-content>
    </div>
  `,
  host: {
    class: 'dbx-detail-block d-block',
    '[class.dbx-detail-block-big-header]': 'bigHeader()'
  },
  imports: [DbxDetailBlockHeaderComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxDetailBlockComponent {
  readonly icon = input<Maybe<string>>();
  readonly header = input<Maybe<string>>();
  readonly alignHeader = input<boolean>(false);
  readonly bigHeader = input<boolean>(false);
}
