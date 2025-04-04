import { OnInit, Directive, inject, input, InputSignalWithTransform } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { isNotFalse, isNotNullOrEmptyString, type Maybe } from '@dereekb/util';
import { TwoColumnsContextStore } from './two.column.store';

/**
 * Used with a DbxTwoColumnComponent to set the full left to true.
 */
@Directive({
  selector: '[dbxTwoColumnFullLeft]',
  standalone: true
})
export class DbxTwoColumnFullLeftDirective implements OnInit {
  private readonly _twoColumnsContextStore = inject(TwoColumnsContextStore);
  readonly fullLeft = input<boolean, Maybe<boolean | ''>>(true, { alias: 'dbxTwoColumnFullLeft', transform: isNotFalse });

  ngOnInit(): void {
    this._twoColumnsContextStore.setFullLeft(toObservable(this.fullLeft));
  }
}
