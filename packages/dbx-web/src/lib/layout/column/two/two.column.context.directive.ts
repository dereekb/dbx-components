import { Input, OnDestroy, Directive, OnInit } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { BehaviorSubject } from 'rxjs';
import { provideTwoColumnsContext, TwoColumnsContextStore } from './two.column.store';

/**
 * Provides a dbxTwoColumnContextStore
 */
@Directive({
  selector: '[dbxTwoColumnContext]',
  providers: provideTwoColumnsContext()
})
export class DbxTwoColumnContextDirective implements OnInit, OnDestroy {

  private _showRight = new BehaviorSubject<Maybe<boolean>>(undefined);

  constructor(readonly twoColumnsContextStore: TwoColumnsContextStore) { }

  ngOnInit(): void {
    this.twoColumnsContextStore.setShowRight(this._showRight);
  }

  ngOnDestroy(): void {
    this._showRight.complete();
  }

  @Input()
  set showRight(showRight: Maybe<boolean>) {
    this._showRight.next(showRight);
  }

}
