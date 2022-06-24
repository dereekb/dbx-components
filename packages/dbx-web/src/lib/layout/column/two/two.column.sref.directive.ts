import { Directive, Input } from '@angular/core';
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
  constructor(private readonly _twoColumnsContextStore: TwoColumnsContextStore) {}

  @Input('dbxTwoColumnSref')
  public set ref(ref: Maybe<SegueRefOrSegueRefRouterLink | ''>) {
    const segueRef = ref ? asSegueRef(ref) : undefined;
    this._twoColumnsContextStore.setBackRef(segueRef);
  }
}
