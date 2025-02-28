import { OnInit, Directive, Input, OnDestroy, inject } from '@angular/core';
import { isNotNullOrEmptyString, type Maybe } from '@dereekb/util';
import { BehaviorSubject } from 'rxjs';
import { TwoColumnsContextStore } from './two.column.store';

/**
 * Used with a DbxTwoColumnComponent to set the full left to true.
 */
@Directive({
  selector: '[dbxTwoColumnFullLeft]'
})
export class DbxTwoColumnFullLeftDirective implements OnInit, OnDestroy {
  private readonly _twoColumnsContextStore = inject(TwoColumnsContextStore);

  private _fullLeft = new BehaviorSubject<boolean>(true);

  @Input('dbxTwoColumnFullLeft')
  get fullLeft(): boolean {
    return this._fullLeft.value;
  }

  set fullLeft(fullLeft: Maybe<boolean | ''>) {
    if (isNotNullOrEmptyString(fullLeft)) {
      // only respond to boolean values
      this._fullLeft.next(Boolean(fullLeft));
    }
  }

  ngOnInit(): void {
    this._twoColumnsContextStore.setFullLeft(this._fullLeft);
  }

  ngOnDestroy(): void {
    this._fullLeft.complete();
  }
}
