import { ChangeDetectionStrategy, Component, computed, inject, input, OnDestroy } from '@angular/core';
import { DbxFirebaseModelEntity, DbxFirebaseModelEntityWithKeyAndStore, DbxFirebaseModelEntityWithStore } from './model.entities';
import { MatAccordion } from '@angular/material/expansion';
import { DbxListEmptyContentComponent, DbxLoadingComponent } from '@dereekb/dbx-web';
import { DbxFirebaseModelEntitiesEntityComponent } from './model.entities.entity.component';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, defaultIfEmpty, map, Observable, shareReplay, switchMap } from 'rxjs';
import { filterUniqueValues, Maybe, reverseCompareFn, sortByNumberFunction } from '@dereekb/util';
import { beginLoading, filterMaybeArray, LoadingState, loadingStateContext, mapLoadingStateValueWithOperator, switchMapMaybe, valueFromFinishedLoadingState } from '@dereekb/rxjs';
import { DbxFirebaseModelEntitiesWidgetService } from './model.entities.widget.service';

@Component({
  selector: 'dbx-firebase-model-entities',
  template: `
    <dbx-loading [linear]="true" [context]="context">
      <mat-accordion [multi]="multi()">
        @for (entity of entitiesWithKeysSignal(); track entity.key) {
          <dbx-firebase-model-entities-entity [entity]="entity"></dbx-firebase-model-entities-entity>
        }
      </mat-accordion>
      @if (hasNoEntitiesSignal()) {
        <dbx-list-empty-content>
          <ng-content select="[empty]"></ng-content>
        </dbx-list-empty-content>
      }
    </dbx-loading>
  `,
  imports: [MatAccordion, DbxLoadingComponent, DbxFirebaseModelEntitiesEntityComponent, DbxListEmptyContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseModelEntitiesComponent implements OnDestroy {
  readonly entitiesWidgetService = inject(DbxFirebaseModelEntitiesWidgetService);

  /**
   * Whether the accordion should allow multiple expanded panels.
   */
  readonly multi = input<boolean>(true);

  readonly entities = input<Observable<LoadingState<DbxFirebaseModelEntity[]>>>();
  readonly entities$: Observable<LoadingState<DbxFirebaseModelEntity[]>> = toObservable(this.entities).pipe(
    switchMapMaybe(),
    map((x) => x ?? beginLoading<DbxFirebaseModelEntity[]>()),
    shareReplay(1)
  );

  readonly allEntitiesWithKeysState$: Observable<LoadingState<DbxFirebaseModelEntityWithKeyAndStore[]>> = this.entities$.pipe(
    mapLoadingStateValueWithOperator(
      switchMap((entities) => {
        const sortPriorityMap = this.entitiesWidgetService.getSortPriorityMap();
        const entitiesWithStore = (entities ?? []).filter((x) => Boolean(x.store)) as DbxFirebaseModelEntityWithStore[];

        interface DbxFirebaseModelEntityWithKeyAndStoreAndSortPriority extends DbxFirebaseModelEntityWithKeyAndStore {
          readonly sortPriority: number;
          readonly isKnownType: boolean;
        }

        const entitiesWithKeys: Observable<Maybe<DbxFirebaseModelEntityWithKeyAndStoreAndSortPriority>[]> = combineLatest(
          entitiesWithStore.map((x) => {
            const sortPriorityMapEntry = sortPriorityMap.get(x.modelIdentity);
            const isKnownType = sortPriorityMapEntry != null;
            const sortPriority = sortPriorityMapEntry ?? -2;

            const obs: Observable<Maybe<DbxFirebaseModelEntityWithKeyAndStoreAndSortPriority>> = x.store.currentKey$.pipe(map((key) => (key ? { key, ...x, sortPriority, isKnownType } : null)));
            return obs;
          })
        );

        return entitiesWithKeys.pipe(
          filterMaybeArray(),
          map((entities) => {
            return filterUniqueValues(entities, (x) => x.key).sort(reverseCompareFn(sortByNumberFunction((x) => x.sortPriority)));
          }),
          defaultIfEmpty([])
        );
      })
    ),
    shareReplay(1)
  );

  readonly entitiesWithKeys$ = this.allEntitiesWithKeysState$.pipe(valueFromFinishedLoadingState(), shareReplay(1));

  readonly entitiesWithKeysSignal = toSignal(this.entitiesWithKeys$, { initialValue: [] });

  readonly hasNoEntitiesSignal = computed(() => !this.entitiesWithKeysSignal()?.length);

  readonly context = loadingStateContext({ obs: this.allEntitiesWithKeysState$ });

  ngOnDestroy(): void {
    this.context.destroy();
  }
}
