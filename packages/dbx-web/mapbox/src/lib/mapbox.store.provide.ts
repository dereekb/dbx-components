import { Directive, Injectable, Injector, Optional, Provider, SkipSelf, inject } from '@angular/core';
import { DbxMapboxMapStore } from './mapbox.store';

/**
 * Token used by provideMapboxStoreIfDoesNotExist() to prevent injecting a parent DbxMapboxMapStore into the child view.
 */
@Injectable()
export class DbxMapboxMapStoreProviderBlock {
  readonly dbxMapboxMapStore = inject(DbxMapboxMapStore, { skipSelf: true });
}

@Directive({
  selector: '[dbxMapboxStoreParentBlocker]',
  providers: [DbxMapboxMapStoreProviderBlock]
})
export class DbxMapboxMapStoreInjectionBlockDirective {}

/**
 * Creates a Provider that initializes a new DbxMapboxMapStore if a parent does not exist.
 *
 * If a DbxMapboxMapStoreInjectionBlock is available in the context, and references the same dbxMapboxMapStore that is attempting to be injected, a new DbxMapboxMapStore is created.
 *
 * @returns
 */
export function provideMapboxStoreIfParentIsUnavailable(): Provider {
  return {
    provide: DbxMapboxMapStore,
    useFactory: (parentInjector: Injector, dbxMapboxMapStoreInjectionBlock?: DbxMapboxMapStoreProviderBlock, dbxMapboxMapStore?: DbxMapboxMapStore) => {
      if (!dbxMapboxMapStore || (dbxMapboxMapStore && dbxMapboxMapStoreInjectionBlock != null && dbxMapboxMapStoreInjectionBlock.dbxMapboxMapStore === dbxMapboxMapStore)) {
        // create a new dbxMapboxMapStore to use
        const injector = Injector.create({ providers: [{ provide: DbxMapboxMapStore }], parent: parentInjector });
        dbxMapboxMapStore = injector.get(DbxMapboxMapStore);
      }

      return dbxMapboxMapStore;
    },
    deps: [Injector, [new Optional(), DbxMapboxMapStoreProviderBlock], [new Optional(), new SkipSelf(), DbxMapboxMapStore]]
  };
}
