import { Directive } from '@angular/core';
import { DbxFirebaseModelEntitiesSource, DbxFirebaseModelEntity } from './model.entities';
import { DbxFirebaseDocumentStoreContextStore } from '../../store/store.document.context.store';
import { map, Observable } from 'rxjs';
import { loadingStateFromObs } from '@dereekb/rxjs';

export const dbxFirebaseDocumentStoreContextModelEntitiesSourceFactory = (storeContextStore: DbxFirebaseDocumentStoreContextStore): DbxFirebaseModelEntitiesSource => {
  const entities$: Observable<DbxFirebaseModelEntity[]> = storeContextStore.entriesGroupedByIdentity$.pipe(map((entries) => entries.map((entry) => ({ store: entry.store, modelIdentity: entry.modelIdentity }))));

  const source: DbxFirebaseModelEntitiesSource = {
    entities$: loadingStateFromObs(entities$)
  };

  return source;
};

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
