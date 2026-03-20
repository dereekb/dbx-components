import { type SystemState, type SystemStateStoredData, type SystemStateTypeIdentifier } from '@dereekb/firebase';
import { type LoadingState, mapLoadingState } from '@dereekb/rxjs';
import { map, type Observable, shareReplay } from 'rxjs';
import { SystemStateDocumentStore } from './systemstate.document.store';
import { Injectable, Injector, inject } from '@angular/core';
import { newWithInjector } from '@dereekb/dbx-core';

/**
 * Abstract class used for accessing a SystemStateDocumentStore's data.
 */
@Injectable()
export abstract class AbstractSystemStateDocumentStoreAccessor<T extends SystemStateStoredData = SystemStateStoredData> {
  readonly systemStateDocumentStore = newWithInjector(SystemStateDocumentStore<T>, inject(Injector));

  readonly documentData$ = this.systemStateDocumentStore.data$;
  readonly data$: Observable<T> = this.documentData$.pipe(
    map((x) => x.data),
    shareReplay(1)
  );
  readonly dataState$: Observable<LoadingState<T>> = this.systemStateDocumentStore.dataLoadingState$.pipe(mapLoadingState({ mapValue: (x: SystemState<T>) => x.data }), shareReplay(1));
  readonly exists$ = this.systemStateDocumentStore.exists$;
  readonly doesNotExist$ = this.systemStateDocumentStore.doesNotExist$;

  readonly type$: Observable<SystemStateTypeIdentifier> = this.systemStateDocumentStore.id$;

  // eslint-disable-next-line @angular-eslint/prefer-inject -- abstract class receives type identifier from subclass constructors
  constructor(type: SystemStateTypeIdentifier) {
    this.systemStateDocumentStore.setId(type);
  }
}
