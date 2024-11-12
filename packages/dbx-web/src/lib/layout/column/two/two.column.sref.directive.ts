import { Directive, Input, inject } from '@angular/core';
import { asSegueRef, SegueRefOrSegueRefRouterLink } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';
import { TwoColumnsContextStore } from './two.column.store';

/**
 * Used with a DbxTwoColumnComponent to set the backRef of the TwoColumnsContextStore.
 */
@Directive({
  selector: '[dbxTwoColumnSref]'
})
export class DbxTwoColumnSrefDirective {
  private readonly _twoColumnsContextStore = inject(TwoColumnsContextStore);

  @Input('dbxTwoColumnSref')
  public set ref(ref: Maybe<SegueRefOrSegueRefRouterLink | ''>) {
    const segueRef = ref ? asSegueRef(ref) : undefined;
    this._twoColumnsContextStore.setBackRef(segueRef);
  }
}
