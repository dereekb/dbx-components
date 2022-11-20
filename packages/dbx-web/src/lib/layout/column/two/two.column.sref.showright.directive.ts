import { shareReplay } from 'rxjs/operators';
import { Directive, OnInit, OnDestroy } from '@angular/core';
import { AbstractSubscriptionDirective, DbxRouterService, isSegueRefActive } from '@dereekb/dbx-core';
import { TwoColumnsContextStore } from './two.column.store';
import { distinctUntilChanged, Subscription } from 'rxjs';
import { isNot } from '@dereekb/rxjs';

/**
 * Used with a DbxTwoColumnComponent to control showing right when the current route is a child of the backRef.
 */
@Directive({
  selector: '[dbxTwoColumnSrefShowRight]'
})
export class DbxTwoColumnSrefShowRightDirective extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  readonly showRight$ = this._twoColumnsContextStore.backRef$.pipe(
    // Only show right when the backRef is not exactly active
    isSegueRefActive({ dbxRouterService: this._dbxRouterService, activeExactly: true }),
    isNot(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  constructor(private readonly _twoColumnsContextStore: TwoColumnsContextStore, private readonly _dbxRouterService: DbxRouterService) {
    super();
  }

  ngOnInit(): void {
    this.sub = this._twoColumnsContextStore.setShowRight(this.showRight$) as Subscription;
  }
}
