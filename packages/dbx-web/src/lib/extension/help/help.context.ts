import { asObservable, type ObservableOrValue } from '@dereekb/rxjs';
import { type DbxHelpContextReference, type DbxHelpContextKey } from './help';
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
export function registerHelpContextKeysWithDbxHelpContextService(helpContextKeys: ObservableOrValue<DbxHelpContextKey[]>): DestroyFunction {
  const helpContextService = inject(DbxHelpContextService);
  const destroyRef = inject(DestroyRef);

  const helpContextReference: DbxHelpContextReference = {
    helpContextKeys$: asObservable(helpContextKeys)
  };

  helpContextService.register(helpContextReference);

  function _destroy() {
    helpContextService.unregister(helpContextReference);
  }

  destroyRef.onDestroy(_destroy);

  return _destroy;
}
