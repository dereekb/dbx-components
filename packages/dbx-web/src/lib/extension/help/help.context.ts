import { asObservable, type ObservableOrValue } from '@dereekb/rxjs';
import { type DbxHelpContextReference, type DbxHelpContextKey } from './help';
import { DestroyRef, inject } from '@angular/core';
import { DbxHelpContextService } from './help.context.service';
import { type DestroyFunction } from '@dereekb/util';

/**
 * Registers the given help context keys observable with the {@link DbxHelpContextService}. Must be called within an Angular injection context.
 * Automatically unregisters on destroy, but also returns a destroy function for manual cleanup.
 *
 * @example
 * ```typescript
 * // In a component or directive constructor
 * const destroy = registerHelpContextKeysWithDbxHelpContextService(of(['feature-help', 'general-help']));
 * ```
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
