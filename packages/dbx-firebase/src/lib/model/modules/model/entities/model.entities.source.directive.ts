import { Directive } from '@angular/core';
import { DbxFirebaseModelEntitiesSource, type DbxFirebaseModelEntity } from './model.entities';
import { DbxFirebaseDocumentStoreContextStore } from '../../store/store.document.context.store';
import { map, type Observable } from 'rxjs';
import { loadingStateFromObs } from '@dereekb/rxjs';

/**
 * Factory that creates a {@link DbxFirebaseModelEntitiesSource} from a {@link DbxFirebaseDocumentStoreContextStore},
 * mapping its entries into model entities grouped by identity.
 *
 * @param storeContextStore - The document store context store providing entries grouped by identity.
 * @returns A DbxFirebaseModelEntitiesSource backed by the given store context.
 */
export const dbxFirebaseDocumentStoreContextModelEntitiesSourceFactory = (storeContextStore: DbxFirebaseDocumentStoreContextStore): DbxFirebaseModelEntitiesSource => {
  const entities$: Observable<DbxFirebaseModelEntity[]> = storeContextStore.entriesGroupedByIdentity$.pipe(map((entries) => entries.map((entry) => ({ store: entry.store, modelIdentity: entry.modelIdentity }))));

  const source: DbxFirebaseModelEntitiesSource = {
    entities$: loadingStateFromObs(entities$)
  };

  return source;
};

/**
 * Directive that provides a {@link DbxFirebaseModelEntitiesSource} from the current document store context.
 */
@Directive({
  selector: '[dbxFirebaseDocumentStoreContextModelEntitiesSource]',
  providers: [
    {
      provide: DbxFirebaseModelEntitiesSource,
      useFactory: dbxFirebaseDocumentStoreContextModelEntitiesSourceFactory,
      deps: [DbxFirebaseDocumentStoreContextStore]
    }
  ],
  standalone: true
})
export class DbxFirebaseDocumentStoreContextModelEntitiesSourceDirective {}
