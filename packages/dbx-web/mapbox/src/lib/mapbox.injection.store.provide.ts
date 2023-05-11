import { Directive, Injectable, Injector, Optional, Provider, SkipSelf } from '@angular/core';
import { DbxMapboxInjectionStore } from './mapbox.injection.store';

/**
 * Token used by provideMapboxInjectionStoreIfDoesNotExist() to prevent injecting a parent DbxMapboxInjectionStore into the child view.
 */
@Injectable()
export class DbxMapboxInjectionStoreProviderBlock {
  constructor(@SkipSelf() readonly dbxMapboxInjectionStore: DbxMapboxInjectionStore) {}
}

@Directive({
  selector: '[dbxMapboxInjectionStoreParentBlocker]',
  providers: [DbxMapboxInjectionStoreProviderBlock]
})
export class DbxMapboxInjectionStoreInjectionBlockDirective {}

/**
 * Creates a Provider that initializes a new DbxMapboxInjectionStore if a parent does not exist.
 *
 * If a DbxMapboxInjectionStoreInjectionBlock is available in the context, and references the same dbxMapboxInjectionStore that is attempting to be injected, a new DbxMapboxInjectionStore is created.
 *
 * @returns
 */
export function provideMapboxInjectionStoreIfParentIsUnavailable(): Provider {
  return {
    provide: DbxMapboxInjectionStore,
    useFactory: (parentInjector: Injector, dbxMapboxInjectionStoreInjectionBlock?: DbxMapboxInjectionStoreProviderBlock, dbxMapboxInjectionStore?: DbxMapboxInjectionStore) => {
      if (!dbxMapboxInjectionStore || (dbxMapboxInjectionStore && dbxMapboxInjectionStoreInjectionBlock != null && dbxMapboxInjectionStoreInjectionBlock.dbxMapboxInjectionStore === dbxMapboxInjectionStore)) {
        // create a new dbxMapboxInjectionStore to use
        const injector = Injector.create({ providers: [{ provide: DbxMapboxInjectionStore }], parent: parentInjector });
        dbxMapboxInjectionStore = injector.get(DbxMapboxInjectionStore);
      }

      return dbxMapboxInjectionStore;
    },
    deps: [Injector, [new Optional(), DbxMapboxInjectionStoreProviderBlock], [new Optional(), new SkipSelf(), DbxMapboxInjectionStore]]
  };
}
