import { ChangeDetectionStrategy, Component, Input, OnDestroy, inject, input } from '@angular/core';
import { AnchorForValueFunction, DbxListItemAnchorModifierDirective, DbxValueListItemModifierDirective } from '@dereekb/dbx-web';
import { ListLoadingState, loadingStateFromObs } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { BehaviorSubject, switchMap, shareReplay, Observable } from 'rxjs';
import { DbxFirebaseModelTrackerHistoryFilter, DbxFirebaseModelTrackerService } from './model.tracker.service';
import { DbxFirebaseModelTypesServiceInstancePair } from '../model.types.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { DbxFirebaseModelTypeInstanceListComponent } from '../model.types.list.component';

@Component({
  selector: 'dbx-firebase-model-history',
  template: `
    <dbx-firebase-model-type-instance-list [state]="state" dbxListItemModifier [dbxListItemAnchorModifier]="anchorForItem()">
      <ng-content empty select="[empty]"></ng-content>
    </dbx-firebase-model-type-instance-list>
  `,
  imports: [DbxFirebaseModelTypeInstanceListComponent, DbxListItemAnchorModifierDirective, DbxValueListItemModifierDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseModelHistoryComponent {
  readonly dbxFirebaseModelTrackerService = inject(DbxFirebaseModelTrackerService);

  readonly anchorForItem = input<Maybe<AnchorForValueFunction<DbxFirebaseModelTypesServiceInstancePair>>>();
  readonly historyFilter = input<Maybe<DbxFirebaseModelTrackerHistoryFilter>>();

  readonly historyPairs$ = toObservable(this.historyFilter).pipe(
    switchMap((x) => this.dbxFirebaseModelTrackerService.filterHistoryPairs(x)),
    shareReplay(1)
  );

  readonly state: Observable<ListLoadingState<DbxFirebaseModelTypesServiceInstancePair>> = loadingStateFromObs(this.historyPairs$);
}
