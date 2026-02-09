import { ChangeDetectionStrategy, Component, computed, inject, input, OnDestroy, signal } from '@angular/core';
import { DbxFirebaseModelEntity, DbxFirebaseModelEntityWithKeyAndStore, DbxFirebaseModelEntityWithStore } from './model.entities';
import { MatAccordion } from '@angular/material/expansion';
import { DbxIconButtonComponent, DbxListEmptyContentComponent, DbxLoadingComponent } from '@dereekb/dbx-web';
import { DbxFirebaseModelEntitiesEntityComponent } from './model.entities.entity.component';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, combineLatestWith, defaultIfEmpty, distinctUntilChanged, map, Observable, shareReplay, switchMap } from 'rxjs';
import { filterUniqueValues, Maybe, reverseCompareFn, separateValues, sortByNumberFunction } from '@dereekb/util';
import { beginLoading, filterMaybeArray, LoadingState, loadingStateContext, mapLoadingStateValueWithOperator, switchMapMaybe, valueFromFinishedLoadingState } from '@dereekb/rxjs';
import { DbxFirebaseModelEntitiesWidgetService } from './model.entities.widget.service';

interface DbxFirebaseModelEntitiesComponentAllEntities {
  readonly entities: DbxFirebaseModelEntityWithKeyAndStore[];
  readonly registeredEntities: DbxFirebaseModelEntityWithKeyAndStore[];
  readonly unregisteredEntities: DbxFirebaseModelEntityWithKeyAndStore[];
  readonly onlyShowRegisteredTypes?: Maybe<boolean>;
}

@Component({
  selector: 'dbx-firebase-model-entities',
  template: `
    <dbx-loading [linear]="true" [context]="context">
      <mat-accordion class="dbx-firebase-model-entities-accordion" [multi]="multi()">
        @for (entity of entitiesWithKeysSignal(); track entity.key) {
          <dbx-firebase-model-entities-entity [entity]="entity"></dbx-firebase-model-entities-entity>
        }
      </mat-accordion>
      @if (hasNoEntitiesSignal()) {
        <dbx-list-empty-content>
          <ng-content select="[empty]"></ng-content>
        </dbx-list-empty-content>
      }
      @if (showViewUnregisteredEntitiesButtonSignal()) {
        <div class="dbx-pt3 text-center">
          <dbx-icon-button icon="visibility" [text]="'View ' + unregisteredEntitiesCountSignal() + ' Hidden Entities'" (buttonClick)="clickShowUnregisteredEntities()"></dbx-icon-button>
        </div>
      }
    </dbx-loading>
  `,
  imports: [MatAccordion, DbxLoadingComponent, DbxFirebaseModelEntitiesEntityComponent, DbxListEmptyContentComponent, DbxIconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseModelEntitiesComponent implements OnDestroy {
  readonly entitiesWidgetService = inject(DbxFirebaseModelEntitiesWidgetService);

  /**
   * Whether the accordion should allow multiple expanded panels.
   */
  readonly multi = input<boolean>(true);

  /**
   * If true, will only show entities that have a registered widget entry.
   *
   * Defaults to true.
   */
  readonly onlyShowRegisteredTypes = input<Maybe<boolean>>(true);

  /**
   * If true, will show unregistered entities, even if onlyShowRegisteredTypes is true.
   */
  readonly showUnregisteredTypesSignal = signal<Maybe<boolean>>(undefined);

  readonly onlyShowRegisteredTypesSignal = computed(() => {
    const onlyShowRegisteredTypes = this.onlyShowRegisteredTypes();
    const showUnregisteredTypes = this.showUnregisteredTypesSignal();

    return !showUnregisteredTypes && onlyShowRegisteredTypes;
  });

  readonly onlyShowRegisteredTypes$ = toObservable(this.onlyShowRegisteredTypesSignal).pipe(distinctUntilChanged(), shareReplay(1));

  readonly entities = input<Observable<LoadingState<DbxFirebaseModelEntity[]>>>();
  readonly entities$: Observable<LoadingState<DbxFirebaseModelEntity[]>> = toObservable(this.entities).pipe(
    switchMapMaybe(),
    map((x) => x ?? beginLoading<DbxFirebaseModelEntity[]>()),
    shareReplay(1)
  );

  readonly allEntitiesState$: Observable<LoadingState<DbxFirebaseModelEntitiesComponentAllEntities>> = this.entities$.pipe(
    mapLoadingStateValueWithOperator(
      switchMap((entities) => {
        const sortPriorityMap = this.entitiesWidgetService.getSortPriorityMap();
        const entitiesWithStore = (entities ?? []).filter((x) => Boolean(x.store)) as DbxFirebaseModelEntityWithStore[];

        interface DbxFirebaseModelEntityWithKeyAndStoreAndSortPriority extends DbxFirebaseModelEntityWithKeyAndStore {
          readonly sortPriority: number;
          readonly isRegisteredType: boolean;
        }

        const entitiesWithKeys: Observable<Maybe<DbxFirebaseModelEntityWithKeyAndStoreAndSortPriority>[]> = combineLatest(
          entitiesWithStore.map((x) => {
            const sortPriorityMapEntry = sortPriorityMap.get(x.modelIdentity);
            const isRegisteredType = sortPriorityMapEntry != null;
            const sortPriority = sortPriorityMapEntry ?? -2;

            const obs: Observable<Maybe<DbxFirebaseModelEntityWithKeyAndStoreAndSortPriority>> = x.store.currentKey$.pipe(map((key) => (key ? { key, ...x, sortPriority, isRegisteredType } : null)));
            return obs;
          })
        );

        return entitiesWithKeys.pipe(
          filterMaybeArray(),
          defaultIfEmpty([]),
          combineLatestWith(this.onlyShowRegisteredTypes$),
          map(([entities, onlyShowRegisteredTypes]) => {
            const filteredEntities = filterUniqueValues(entities, (x) => x.key).sort(reverseCompareFn(sortByNumberFunction((x) => x.sortPriority)));

            const { included: registeredEntities, excluded: unregisteredEntities } = separateValues(filteredEntities, (x) => x.isRegisteredType);

            const result: DbxFirebaseModelEntitiesComponentAllEntities = {
              entities: onlyShowRegisteredTypes ? registeredEntities : filteredEntities,
              onlyShowRegisteredTypes,
              registeredEntities,
              unregisteredEntities
            };

            return result;
          })
        );
      })
    ),
    shareReplay(1)
  );

  readonly allEntities$ = this.allEntitiesState$.pipe(valueFromFinishedLoadingState(), shareReplay(1));
  readonly allEntitiesSignal = toSignal(this.allEntities$, { initialValue: { entities: [], registeredEntities: [], unregisteredEntities: [], onlyShowRegisteredTypes: false } });

  readonly entitiesWithKeysSignal = computed(() => this.allEntitiesSignal()?.entities);
  readonly unregisteredEntitiesCountSignal = computed(() => this.allEntitiesSignal()?.unregisteredEntities?.length ?? 0);

  readonly showViewUnregisteredEntitiesButtonSignal = computed(() => {
    const { onlyShowRegisteredTypes, unregisteredEntities } = this.allEntitiesSignal() ?? {};
    return onlyShowRegisteredTypes && Boolean(unregisteredEntities?.length);
  });

  readonly hasNoEntitiesSignal = computed(() => !this.entitiesWithKeysSignal()?.length);

  readonly context = loadingStateContext({ obs: this.allEntitiesState$ });

  ngOnDestroy(): void {
    this.context.destroy();
  }

  clickShowUnregisteredEntities() {
    this.showUnregisteredTypesSignal.set(true);
  }
}
