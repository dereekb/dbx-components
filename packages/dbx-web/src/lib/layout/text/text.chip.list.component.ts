import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DbxChipDisplay, DbxChipDirective } from './text.chip.directive';

/**
 * Renders a row of colored chips from an array of {@link DbxChipDisplay} items.
 *
 * Uses {@link DbxChipDirective} internally with `dbx-chip-spacer` class for spacing.
 *
 * @dbxWebComponent
 * @dbxWebSlug chip-list
 * @dbxWebCategory text
 * @dbxWebRelated chip
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-chip-list></dbx-chip-list>
 * ```
 *
 * @example
 * ```html
 * <dbx-chip-list>
 *   <dbx-chip text="Tag1"></dbx-chip>
 *   <dbx-chip text="Tag2"></dbx-chip>
 * </dbx-chip-list>
 * ```
 */
@Component({
  selector: 'dbx-chip-list',
  template: `
    @for (chip of chips(); track chip.key ?? chip.label) {
      <dbx-chip class="dbx-chip-spacer" [display]="chip" [small]="small()">{{ chip.label }}</dbx-chip>
    }
  `,
  host: {
    class: 'dbx-chip-list',
    '[style.display]': '"inline"'
  },
  imports: [DbxChipDirective],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxChipListComponent {
  readonly chips = input<Maybe<DbxChipDisplay[]>>();
  readonly small = input<Maybe<boolean>>();
}
