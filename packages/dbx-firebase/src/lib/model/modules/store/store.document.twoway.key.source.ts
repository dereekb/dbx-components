import { type Type, type Provider, forwardRef } from '@angular/core';
import { type TwoWayFlatFirestoreModelKey } from '@dereekb/firebase';
import { type Observable } from 'rxjs';

export abstract class DbxFirebaseDocumentStoreTwoWayKeyProvider {
  abstract readonly twoWayFlatKey$: Observable<TwoWayFlatFirestoreModelKey>;
}

/**
 * Configures Providers for a DbxFirebaseDocumentStoreTwoWayKeyProvider.
 *
 * @param sourceType - The type to register as the DbxFirebaseDocumentStoreTwoWayKeyProvider.
 * @returns Array of Angular providers for the two-way key provider.
 */
export function provideDbxFirebaseDocumentStoreTwoWayKeyProvider<S extends DbxFirebaseDocumentStoreTwoWayKeyProvider>(sourceType: Type<S>): Provider[] {
  const providers: Provider[] = [
    {
      provide: DbxFirebaseDocumentStoreTwoWayKeyProvider,
      useExisting: forwardRef(() => sourceType)
    }
  ];

  return providers;
}
