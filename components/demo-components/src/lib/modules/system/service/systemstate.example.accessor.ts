import { Service, Injector, inject } from '@angular/core';
import { newWithInjector } from '@dereekb/dbx-core';
import { DemoExampleSystemDataDocumentStoreAccessor } from '../store/systemstate.example.store.accessor';

/**
 * Service used to access all system company data.
 */
@Service()
export class DemoSystemStateAccessor {
  private _demoExampleSystemStateDocumentStore: DemoExampleSystemDataDocumentStoreAccessor = newWithInjector(DemoExampleSystemDataDocumentStoreAccessor, inject(Injector));

  readonly exampleSystemState$ = this._demoExampleSystemStateDocumentStore.dataState$;
}
