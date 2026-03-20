import { Directive, input, computed } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Renders a styled chip element with optional small and block display modes.
 *
 * @example
 * ```html
 * <dbx-chip [small]="true">Tag</dbx-chip>
 * <dbx-chip [block]="true">Full Width</dbx-chip>
 * ```
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'dbx-chip',
  host: {
    class: 'dbx-chip mat-standard-chip',
    '[class]': 'styleSignal()'
  },
  standalone: true
})
export class DbxChipDirective {
  readonly small = input<Maybe<boolean>>();
  readonly block = input<Maybe<boolean>>();

  readonly styleSignal = computed(() => {
    let style = this.small() ? 'dbx-chip-small' : '';

    if (this.block()) {
      style = style + ' dbx-chip-block';
    }

    return style;
  });
}
