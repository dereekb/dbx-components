import { Directive, inject } from '@angular/core';
import { actionContextStoreSourceMap, ActionContextStoreSourceMap } from './action.map';
import { clean } from '../../../rxjs/clean';

/**
 * Directive that creates and provides an {@link ActionContextStoreSourceMap} for its descendants.
 *
 * This enables a group of related action contexts to be registered by key and looked up
 * by child directives. Useful when multiple actions need to coordinate (e.g., disable
 * all other actions while one is working).
 *
 * The map is exported as `actionMap` for template reference access.
 *
 * @example
 * ```html
 * <div dbxActionContextMap>
 *   <div dbxAction [dbxActionMapSource]="'save'">...</div>
 *   <div dbxAction [dbxActionMapSource]="'delete'">...</div>
 *   <div [dbxActionFromMap]="'save'">
 *     <!-- consumes the 'save' action context -->
 *   </div>
 * </div>
 * ```
 *
 * @see {@link DbxActionFromMapDirective} for consuming actions by key.
 * @see {@link DbxActionMapSourceDirective} for registering actions by key.
 * @see {@link DbxActionMapWorkingDisableDirective} for cross-action disable coordination.
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
