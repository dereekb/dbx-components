import { Directive, input, computed } from '@angular/core';
import { type Maybe } from '@dereekb/util';

@Directive({
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
