import { ChangeDetectionStrategy, Component, computed, input, OnDestroy } from '@angular/core';
import { DbxFirebaseModelEntity, DbxFirebaseModelEntityWithKeyAndStore, DbxFirebaseModelEntityWithStore } from './model.entities';
import { MatAccordion } from '@angular/material/expansion';
import { DbxListEmptyContentComponent, DbxLoadingComponent } from '@dereekb/dbx-web';
import { DbxFirebaseModelEntitiesEntityComponent } from './model.entities.entity.component';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, defaultIfEmpty, map, Observable, shareReplay, switchMap } from 'rxjs';
import { Maybe } from '@dereekb/util';
import { beginLoading, filterMaybeArray, LoadingState, loadingStateContext, mapLoadingStateValueWithOperator, switchMapMaybe, valueFromFinishedLoadingState } from '@dereekb/rxjs';

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
  /**
   * All input entities.
   */
  readonly entities = input<Observable<LoadingState<DbxFirebaseModelEntity[]>>>();
  readonly entities$: Observable<LoadingState<DbxFirebaseModelEntity[]>> = toObservable(this.entities).pipe(
    switchMapMaybe(),
    map((x) => x ?? beginLoading<DbxFirebaseModelEntity[]>()),
    shareReplay(1)
  );

  /**
   * Whether the accordion should allow multiple expanded panels.
   */
  readonly multi = input<boolean>(true);

  readonly entitiesWithKeysState$: Observable<LoadingState<DbxFirebaseModelEntityWithKeyAndStore[]>> = this.entities$.pipe(
    mapLoadingStateValueWithOperator(
      switchMap((entities) => {
        const entitiesWithStore = (entities ?? []).filter((x) => Boolean(x.store)) as DbxFirebaseModelEntityWithStore[];
        const entitiesWithKeys: Observable<Maybe<DbxFirebaseModelEntityWithKeyAndStore>[]> = combineLatest(
          entitiesWithStore.map((x) => {
            const obs: Observable<Maybe<DbxFirebaseModelEntityWithKeyAndStore>> = x.store.currentKey$.pipe(map((key) => (key ? { key, ...x } : null)));
            return obs;
          })
        );

        return entitiesWithKeys.pipe(filterMaybeArray(), defaultIfEmpty([]));
      })
    ),
    shareReplay(1)
  );

  readonly entitiesWithKeys$ = this.entitiesWithKeysState$.pipe(valueFromFinishedLoadingState(), shareReplay(1));

  readonly entitiesWithKeysSignal = toSignal(this.entitiesWithKeys$, { initialValue: [] });

  readonly hasNoEntitiesSignal = computed(() => !this.entitiesWithKeysSignal()?.length);

  readonly context = loadingStateContext({ obs: this.entitiesWithKeysState$ });

  ngOnDestroy(): void {
    this.context.destroy();
  }
}
