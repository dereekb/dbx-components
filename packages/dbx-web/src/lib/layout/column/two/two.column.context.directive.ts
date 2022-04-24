import { Input, OnDestroy } from '@angular/core';
import { Directive, OnInit } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { BehaviorSubject } from 'rxjs';
import { ProvideTwoColumnsContext, TwoColumnsContextStore } from './two.column.store';

/**
 * Provides a dbxTwoColumnsContextStore
 */
@Directive({
  selector: '[dbxTwoColumnsContext]',
  providers: ProvideTwoColumnsContext()
})
export class DbxTwoColumnsContextDirective implements OnInit, OnDestroy {

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
