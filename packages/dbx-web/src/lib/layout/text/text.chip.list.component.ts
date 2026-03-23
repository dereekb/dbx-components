import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DbxChipDisplay, DbxChipDirective } from './text.chip.directive';

/**
 * Renders a row of colored chips from an array of {@link DbxChipDisplay} items.
 *
 * Uses {@link DbxChipDirective} internally with `dbx-chip-spacer` class for spacing.
 *
 * @example
 * ```html
 * <dbx-chip-list [chips]="[{ label: 'Active', value: 'active', color: 'primary' }, { label: 'Pending', value: 'pending', color: 'accent' }]"></dbx-chip-list>
 * <dbx-chip-list [chips]="chips" [small]="true"></dbx-chip-list>
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
