import { Component, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxDetailBlockHeaderComponent } from './detail.block.header.component';

/**
 * A structured content block with a header row (icon + label) and a detail content area below.
 *
 * Use the `[header]` content slot for extra header-level content and default content for the detail area.
 *
 * The component provides the structure only. Add the `dbx-detail-block-tile` class for the tile styling: the icon in a
 * round tile beside the content, an uppercase label, and `dbx-detail-block-tile-value` / `dbx-detail-block-tile-hint`
 * lines for the value and its supporting text.
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
 *
 * @example
 * ```html
 * <dbx-detail-block class="dbx-detail-block-tile" header="Hours" icon="schedule">
 *   <span class="dbx-detail-block-tile-value">7:45 AM – 3:30 PM</span>
 *   <span class="dbx-detail-block-tile-hint">Full day · 8 hrs</span>
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
  imports: [DbxDetailBlockHeaderComponent]
})
export class DbxDetailBlockComponent {
  readonly icon = input<Maybe<string>>();
  readonly header = input<Maybe<string>>();
  readonly alignHeader = input<boolean>(false);
  readonly bigHeader = input<boolean>(false);
}
