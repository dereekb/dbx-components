import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbxInjectionComponentModule, SimpleStorageAccessorFactory, StorageAccessor } from '@dereekb/dbx-core';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { DbxListLayoutModule } from '../../layout/list/list.layout.module';
import { DbxModelViewTrackerEventSet } from './model.tracker';
import { DbxModelTrackerService } from './model.tracker.service';
import { DBX_MODEL_VIEW_TRACKER_STORAGE_ACCESSOR_TOKEN, DbxModelViewTrackerStorage } from './model.tracker.view.storage';
import { fromDbxModel } from './state';
import { DbxModelTrackerEffects } from './state/effects/tracker.effects';

export function appObjectViewTrackerStorageAccessorFactory(storageAccessorFactory: SimpleStorageAccessorFactory): StorageAccessor<DbxModelViewTrackerEventSet> {
  const accessor = storageAccessorFactory.createStorageAccessor<DbxModelViewTrackerEventSet>({
    prefix: 'mtvs'
  });

  return accessor;
}

/**
 * Contains components related to displaying content related to models identified only by their model key.
 */
@NgModule({
  imports: [
    //
    CommonModule,
    DbxListLayoutModule,
    DbxInjectionComponentModule,
    EffectsModule.forFeature([DbxModelTrackerEffects]),
    StoreModule.forFeature(fromDbxModel.featureKey, fromDbxModel.reducers)
  ],
  declarations: [],
  exports: []
})
export class DbxModelInfoModule {
  static forRoot(): ModuleWithProviders<DbxModelInfoModule> {
    return {
      ngModule: DbxModelInfoModule,
      providers: [
        DbxModelTrackerService,
        {
          provide: DBX_MODEL_VIEW_TRACKER_STORAGE_ACCESSOR_TOKEN,
          useFactory: appObjectViewTrackerStorageAccessorFactory,
          deps: [SimpleStorageAccessorFactory]
        }
      ]
    };
  }
}
