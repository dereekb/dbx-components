import { Directive, Input, effect, inject, input } from '@angular/core';
import { asSegueRef, SegueRefOrSegueRefRouterLink } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { TwoColumnsContextStore } from './two.column.store';

/**
 * Used with a DbxTwoColumnComponent to set the backRef of the TwoColumnsContextStore.
 */
@Directive({
  selector: '[dbxTwoColumnSref]',
  standalone: true
})
export class DbxTwoColumnSrefDirective {
  private readonly _twoColumnsContextStore = inject(TwoColumnsContextStore);

  readonly dbxTwoColumnSref = input.required<Maybe<SegueRefOrSegueRefRouterLink>>();

  protected readonly _dbxTwoColumnSrefEffect = effect(() => {
    const sref = this.dbxTwoColumnSref();
    const segueRef = sref ? asSegueRef(sref) : undefined;
    this._twoColumnsContextStore.setBackRef(segueRef);
  });
}
