import { Directive, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';

@Directive({
  selector: 'dbx-chip',
  host: {
    class: 'dbx-chip mat-standard-chip',
    '[class]': 'style'
  }
})
export class DbxChipDirective {
  @Input()
  small?: Maybe<boolean>;

  @Input()
  block?: Maybe<boolean>;

  get style() {
    let style = this.small ? 'dbx-chip-small' : '';

    if (this.block) {
      style = style + ' dbx-chip-block';
    }

    return style;
  }
}
