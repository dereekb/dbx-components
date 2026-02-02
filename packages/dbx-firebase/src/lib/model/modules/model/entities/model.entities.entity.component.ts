import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DbxFirebaseModelEntity } from './model.entities';
import { DbxFirebaseModelEntitiesWidgetService, DbxFirebaseModelTypesService } from '@dereekb/dbx-firebase';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription, MatExpansionPanelContent } from '@angular/material/expansion';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { distinct, distinctUntilChanged, map, shareReplay, switchMap } from 'rxjs';
import { filterMaybe } from '@dereekb/rxjs';

@Component({
  selector: 'dbx-firebase-model-entities-entity',
  templateUrl: './model.entities.entity.component.html',
  imports: [DbxInjectionComponent, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription, MatExpansionPanelContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseModelEntitiesEntityComponent {
  readonly widgetService = inject(DbxFirebaseModelEntitiesWidgetService);
  readonly modelTypesService = inject(DbxFirebaseModelTypesService);

  /**
   * The input entity
   */
  readonly entity = input.required<DbxFirebaseModelEntity>();

  readonly modelIdentity = computed(() => this.entity().modelIdentity);

  readonly entity$ = toObservable(this.entity);
  readonly store$ = this.entity$.pipe(
    map((x) => x.store),
    filterMaybe(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly loadingState$ = this.store$.pipe(switchMap((x) => x.dataLoadingState$));

  // TODO: Using the entity/store, pull the display info from the model types service and make that available in a signal.
}
