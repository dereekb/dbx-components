import { Directive, Input } from '@angular/core';
import { SegueRef } from '@dereekb/ngx-core';
import { TwoColumnsContextStore } from './two.column.store';

/**
 * Used with a DbNgxTwoColumnsComponent to set the backRef of the TwoColumnsContextStore.
 */
@Directive({
  selector: '[dbxTwoColumnsSref]'
})
export class DbNgxTwoColumnsSrefDirective {

  constructor(private readonly _twoColumnsContextStore: TwoColumnsContextStore) { }

  @Input('dbxTwoColumnsSref')
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
