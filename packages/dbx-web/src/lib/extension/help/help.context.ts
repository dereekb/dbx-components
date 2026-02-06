import { asObservable, type ObservableOrValue } from '@dereekb/rxjs';
import { type DbxHelpContextReference, type DbxHelpContextString } from './help';
import { DestroyRef, inject } from '@angular/core';
import { DbxHelpContextService } from './help.context.service';
import { type DestroyFunction } from '@dereekb/util';

/**
 * Registers the input observable with the DbxHelpContextService.
 *
 * Must be run in an injectable context.
 *
 * Automatically cleans up, but returns a destroy function for manual cleanup.
 */
export function registerHelpContextStringsWithDbxHelpContextService(helpContextStrings: ObservableOrValue<DbxHelpContextString[]>): DestroyFunction {
  const helpContextService = inject(DbxHelpContextService);
  const destroyRef = inject(DestroyRef);

  const helpContextReference: DbxHelpContextReference = {
    helpContextStrings$: asObservable(helpContextStrings)
  };

  helpContextService.register(helpContextReference);

  function _destroy() {
    helpContextService.unregister(helpContextReference);
  }

  destroyRef.onDestroy(_destroy);

  return _destroy;
}
