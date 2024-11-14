import { SystemState, SystemStateStoredData, SystemStateTypeIdentifier } from '@dereekb/firebase';
import { LoadingState, mapLoadingState } from '@dereekb/rxjs';
import { map, Observable, shareReplay } from 'rxjs';
import { SystemStateDocumentStore } from './systemstate.document.store';
import { Injectable, inject } from '@angular/core';

/**
 * Abstract class used for accessing a SystemStateDocumentStore's data.
 */
@Injectable()
export abstract class AbstractSystemStateDocumentStoreAccessor<T extends SystemStateStoredData = SystemStateStoredData> {
  readonly systemStateDocumentStore = inject(SystemStateDocumentStore<T>);

  readonly documentData$ = this.systemStateDocumentStore.data$;
  readonly data$: Observable<T> = this.documentData$.pipe(
    map((x) => x.data),
    shareReplay(1)
  );
  readonly dataState$: Observable<LoadingState<T>> = this.systemStateDocumentStore.dataLoadingState$.pipe(mapLoadingState({ mapValue: (x: SystemState<T>) => x.data }), shareReplay(1));
  readonly exists$ = this.systemStateDocumentStore.exists$;
  readonly doesNotExist$ = this.systemStateDocumentStore.doesNotExist$;

  readonly type$: Observable<SystemStateTypeIdentifier> = this.systemStateDocumentStore.id$;

  constructor(type: SystemStateTypeIdentifier) {
    this.systemStateDocumentStore.setId(type);
  }
}
