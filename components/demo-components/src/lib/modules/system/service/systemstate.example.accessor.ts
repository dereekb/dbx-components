import { map, type Observable, shareReplay } from 'rxjs';
import { Injectable, Injector, inject } from '@angular/core';
import { newWithInjector } from '@dereekb/dbx-core';
import { SystemStateFirestoreCollections } from '@dereekb/firebase';
import { DemoExampleSystemDataDocumentStoreAccessor } from '../store/systemstate.example.store.accessor';

/**
 * Service used to access all system company data.
 */
@Injectable({
  providedIn: 'root'
})
export class DemoSystemStateAccessor {
  private _demoExampleSystemStateDocumentStore: DemoExampleSystemDataDocumentStoreAccessor = newWithInjector(DemoExampleSystemDataDocumentStoreAccessor, inject(Injector));

  readonly exampleSystemState$ = this._demoExampleSystemStateDocumentStore.dataState$;
}
