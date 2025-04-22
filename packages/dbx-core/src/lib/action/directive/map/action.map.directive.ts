import { Directive, inject, OnDestroy } from '@angular/core';
import { actionContextStoreSourceMap, ActionContextStoreSourceMap } from './action.map';

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
export class DbxActionContextMapDirective implements OnDestroy {
  readonly actionContextStoreSourceMap = inject(ActionContextStoreSourceMap);

  ngOnDestroy(): void {
    this.actionContextStoreSourceMap.destroy();
  }
}
