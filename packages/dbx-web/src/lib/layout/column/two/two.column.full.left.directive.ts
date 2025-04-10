import { OnInit, Directive, inject, input, effect } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { isNotFalse, type Maybe } from '@dereekb/util';
import { TwoColumnsContextStore } from './two.column.store';

/**
 * Used with a DbxTwoColumnComponent to set the full left to true.
 */
@Directive({
  selector: '[dbxTwoColumnFullLeft]',
  standalone: true
})
export class DbxTwoColumnFullLeftDirective {
  private readonly _twoColumnsContextStore = inject(TwoColumnsContextStore);

  readonly fullLeft = input<boolean, Maybe<boolean | ''>>(true, { alias: 'dbxTwoColumnFullLeft', transform: isNotFalse });

  protected readonly _fullLeftEffect = effect(
    () => {
      this._twoColumnsContextStore.setFullLeft(this.fullLeft());
    },
    { allowSignalWrites: true }
  );
}
