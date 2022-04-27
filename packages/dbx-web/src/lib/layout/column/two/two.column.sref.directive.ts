import { Directive, Input } from '@angular/core';
import { SegueRef } from '@dereekb/dbx-core';
import { TwoColumnsContextStore } from './two.column.store';

/**
 * Used with a DbxTwoColumnComponent to set the backRef of the TwoColumnsContextStore.
 */
@Directive({
  selector: '[dbxTwoColumnSref]'
})
export class DbxTwoColumnSrefDirective {

  constructor(private readonly _twoColumnsContextStore: TwoColumnsContextStore) { }

  @Input('dbxTwoColumnSref')
  public set refString(ref: string) {
    this.ref = {
      ref
    };
  }

  @Input()
  public set ref(ref: SegueRef) {
    this._twoColumnsContextStore.setBackRef(ref);
  }

}
