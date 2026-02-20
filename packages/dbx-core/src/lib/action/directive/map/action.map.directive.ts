import { Directive, inject } from '@angular/core';
import { actionContextStoreSourceMap, ActionContextStoreSourceMap } from './action.map';
import { clean } from '../../../rxjs/clean';

/**
 * Context used for providing actions based on the action key.
 *
 * This is useful for passing action contexts around via the providers instead of explicit injection.
 */
@Directive({
  selector: '[dbxActionContextMap]',
  providers: [
    {
      provide: ActionContextStoreSourceMap,
      useFactory: actionContextStoreSourceMap
    }
  ],
  exportAs: 'actionMap',
  standalone: true
})
export class DbxActionContextMapDirective {
  readonly actionContextStoreSourceMap = clean(inject(ActionContextStoreSourceMap));
}
