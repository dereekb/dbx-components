import { Component, Input, OnDestroy, inject } from '@angular/core';
import { AnchorForValueFunction } from '@dereekb/dbx-web';
import { loadingStateFromObs } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { BehaviorSubject, switchMap, shareReplay } from 'rxjs';
import { DbxFirebaseModelTrackerHistoryFilter, DbxFirebaseModelTrackerService } from './model.tracker.service';
import { DbxFirebaseModelTypesServiceInstancePair } from './model.types.service';

@Component({
  selector: 'dbx-firebase-model-history',
  template: `
    <dbx-firebase-model-type-instance-list [state$]="state$" [dbxListItemModifier] [dbxListItemAnchorModifier]="anchorForItem">
      <ng-content empty select="[empty]"></ng-content>
    </dbx-firebase-model-type-instance-list>
  `
})
export class DbxFirebaseModelHistoryComponent implements OnDestroy {
  readonly dbxFirebaseModelTrackerService = inject(DbxFirebaseModelTrackerService);

  private _historyFilter = new BehaviorSubject<Maybe<DbxFirebaseModelTrackerHistoryFilter>>(undefined);

  @Input()
  anchorForItem?: Maybe<AnchorForValueFunction<DbxFirebaseModelTypesServiceInstancePair>>;

  @Input()
  get historyFilter() {
    return this._historyFilter.value;
  }

  set historyFilter(historyFilter: Maybe<DbxFirebaseModelTrackerHistoryFilter>) {
    this._historyFilter.next(historyFilter);
  }

  readonly historyFilter$ = this._historyFilter.asObservable();

  readonly historyPairs$ = this.historyFilter$.pipe(
    switchMap((x) => this.dbxFirebaseModelTrackerService.filterHistoryPairs(x)),
    shareReplay(1)
  );

  readonly state$ = loadingStateFromObs(this.historyPairs$);

  ngOnDestroy(): void {
    this._historyFilter.complete();
  }
}
