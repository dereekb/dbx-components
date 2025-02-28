import { Input, OnDestroy, Directive, OnInit, inject } from '@angular/core';
import { type Maybe } from '@dereekb/util';
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
  readonly twoColumnsContextStore = inject(TwoColumnsContextStore);

  private _showRight = new BehaviorSubject<Maybe<boolean>>(undefined);

  ngOnInit(): void {
    this.twoColumnsContextStore.setShowRight(this._showRight);
  }

  ngOnDestroy(): void {
    this._showRight.complete();
  }

  @Input()
  set showRight(showRight: Maybe<boolean | ''>) {
    this._showRight.next(Boolean(showRight));
  }
}
