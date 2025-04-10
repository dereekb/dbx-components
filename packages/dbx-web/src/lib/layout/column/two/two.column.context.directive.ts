import { Directive, OnInit, effect, inject, input } from '@angular/core';
import { isDefinedAndNotFalse, type Maybe } from '@dereekb/util';
import { provideTwoColumnsContext, TwoColumnsContextStore } from './two.column.store';

/**
 * Provides a dbxTwoColumnContextStore
 */
@Directive({
  selector: '[dbxTwoColumnContext]',
  providers: provideTwoColumnsContext(),
  standalone: true
})
export class DbxTwoColumnContextDirective {
  readonly twoColumnsContextStore = inject(TwoColumnsContextStore, { self: true });
  readonly showRight = input<Maybe<boolean>, Maybe<boolean | ''>>(undefined, { transform: isDefinedAndNotFalse });

  protected readonly _showRightEffect = effect(
    () => {
      this.twoColumnsContextStore.setShowRightOverride(this.showRight());
    },
    { allowSignalWrites: true }
  );
}
