import { type EnvironmentProviders, type Provider, makeEnvironmentProviders } from '@angular/core';
import { SimpleStorageAccessorFactory, type StorageAccessor } from '@dereekb/dbx-core';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { type DbxModelViewTrackerEventSet } from './model.tracker';
import { DbxModelTrackerService } from './model.tracker.service';
import { DBX_MODEL_VIEW_TRACKER_STORAGE_ACCESSOR_TOKEN, DbxModelViewTrackerStorage } from './model.tracker.view.storage';
import { fromDbxModel } from './state';
import { DbxModelTrackerEffects } from './state/effects/tracker.effects';
import { DbxModelObjectStateService } from './model.state.service';

/**
 * Creates a {@link StorageAccessor} for persisting model view tracker events using the `mtvs` storage prefix.
 *
 * @example
 * ```typescript
 * const accessor = defaultDbxModelViewTrackerStorageAccessorFactory(storageAccessorFactory);
 * ```
 *
 * @param storageAccessorFactory - The factory used to create typed storage accessors
 * @returns A storage accessor configured with the `mtvs` prefix for model view tracker events
 */
export function defaultDbxModelViewTrackerStorageAccessorFactory(storageAccessorFactory: SimpleStorageAccessorFactory): StorageAccessor<DbxModelViewTrackerEventSet> {
  return storageAccessorFactory.createStorageAccessor<DbxModelViewTrackerEventSet>({
    prefix: 'mtvs'
  });
}

/**
 * Creates EnvironmentProviders for providing DbxModelTrackerService, DbxModelObjectStateService and sets up the NgRx store for DbxModelTrackerEffects.
 *
 * @returns EnvironmentProviders
 */
export function provideDbxModelService(): EnvironmentProviders {
  const providers: (Provider | EnvironmentProviders)[] = [
    // Storage accessor
    {
      provide: DBX_MODEL_VIEW_TRACKER_STORAGE_ACCESSOR_TOKEN,
      useFactory: defaultDbxModelViewTrackerStorageAccessorFactory,
      deps: [SimpleStorageAccessorFactory]
    },
    // Service
    DbxModelViewTrackerStorage,
    DbxModelTrackerService,
    DbxModelObjectStateService,
    // NgRx
    provideEffects([DbxModelTrackerEffects]),
    provideState(fromDbxModel.FEATURE_KEY, fromDbxModel.reducers)
  ];

  return makeEnvironmentProviders(providers);
}
