import { ChangeDetectionStrategy, Component, computed, inject, input, OnDestroy, Type } from '@angular/core';
import { DbxFirebaseModelEntity } from './model.entities';
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription, MatExpansionPanelContent } from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, distinctUntilChanged, map, Observable, of, shareReplay, switchMap, catchError } from 'rxjs';
import { filterMaybe, loadingStateContext, tapLog } from '@dereekb/rxjs';
import { DbxFirebaseModelEntitiesWidgetService } from './model.entities.widget.service';
import { DbxFirebaseModelTypesService, type DbxFirebaseModelDisplayInfo, type DbxFirebaseModelTypeInfo } from '../model.types.service';
import { type Maybe } from '@dereekb/util';
import { AsyncPipe } from '@angular/common';
import { DbxLoadingComponent } from '@dereekb/dbx-web';
import { dbxFirebaseModelEntityWidgetInjectionConfigFactory } from './model.entities.widget';

@Component({
  selector: 'dbx-firebase-model-entities-entity',
  templateUrl: './model.entities.entity.component.html',
  imports: [DbxInjectionComponent, DbxLoadingComponent, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, MatExpansionPanelDescription, MatExpansionPanelContent, MatIcon, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseModelEntitiesEntityComponent implements OnDestroy {
  readonly widgetInjectionConfigFactory = dbxFirebaseModelEntityWidgetInjectionConfigFactory();

  readonly entitiesWidgetService = inject(DbxFirebaseModelEntitiesWidgetService);
  readonly dbxFirebaseModelTypesService = inject(DbxFirebaseModelTypesService);

  readonly entity = input.required<DbxFirebaseModelEntity>();

  readonly entity$ = toObservable(this.entity);
  readonly modelIdentity$ = this.entity$.pipe(
    map((x) => x.modelIdentity),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly store$ = this.entity$.pipe(
    map((x) => x.store),
    filterMaybe(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly loadingState$ = this.store$.pipe(switchMap((x) => x.dataLoadingState$));
  readonly currentData$ = this.store$.pipe(
    switchMap((x) => x.currentData$),
    shareReplay(1)
  );

  readonly currentWidgetEntry$ = this.modelIdentity$.pipe(
    map((modelIdentity) => this.entitiesWidgetService.getWidgetEntry(modelIdentity)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly currentTypeInfo$: Observable<Maybe<DbxFirebaseModelTypeInfo>> = this.modelIdentity$.pipe(
    switchMap((modelIdentity) => this.dbxFirebaseModelTypesService.currentInfoForType(modelIdentity.modelType)),
    shareReplay(1)
  );

  readonly hasTypeInfo$ = this.currentTypeInfo$.pipe(
    map((x) => !!x),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly displayInfo$: Observable<DbxFirebaseModelDisplayInfo> = combineLatest([this.modelIdentity$, this.currentTypeInfo$, this.currentData$]).pipe(
    map(([modelIdentity, typeInfo, currentData]) => {
      let result: DbxFirebaseModelDisplayInfo;

      if (typeInfo) {
        if (currentData) {
          result = typeInfo.displayInfoFactory(currentData);

          if (!result.title) {
            result = { ...result, title: `No Name - <${modelIdentity.modelType}>` };
          }
        } else {
          result = { icon: typeInfo.icon, title: `No Data - <${modelIdentity.modelType}>` };
        }
      } else {
        result = { icon: 'warning', title: `No Type Info - <${modelIdentity.modelType}>` };
      }

      return result;
    }),
    shareReplay(1)
  );

  readonly widgetInjectionConfig$ = combineLatest([this.currentWidgetEntry$, this.entity$]).pipe(
    map(([entry, entity]) => this.widgetInjectionConfigFactory(entry, entity)),
    shareReplay(1)
  );

  readonly hasTypeInfoSignal = toSignal(this.hasTypeInfo$);
  readonly displayInfoSignal = toSignal(this.displayInfo$);

  readonly widgetInjectionConfigSignal = toSignal(this.widgetInjectionConfig$);

  readonly entityWidgetConfigSignal = computed(() => this.widgetInjectionConfigSignal()?.entityComponentConfig);
  readonly commonWidgetConfigSignal = computed(() => this.widgetInjectionConfigSignal()?.commonComponentConfig);
  readonly debugWidgetConfigSignal = computed(() => this.widgetInjectionConfigSignal()?.debugComponentConfig);

  readonly loadingContext = loadingStateContext({ obs: this.loadingState$ });

  ngOnDestroy(): void {
    this.loadingContext.destroy();
  }
}
