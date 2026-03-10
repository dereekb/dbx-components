import { filterMaybe } from '@dereekb/rxjs';
import { Directive, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { switchMap } from 'rxjs';
import { ActionContextStoreSourceMap, type ActionKey } from './action.map';
import { type SecondaryActionContextStoreSource } from '../../action.store.source';
import { provideSecondaryActionStoreSource } from '../../action.store.source.provide';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Directive that retrieves an {@link ActionContextStoreSource} from an ancestor
 * {@link DbxActionContextMapDirective} using the provided key, and provides it as
 * a {@link SecondaryActionContextStoreSource} for descendant `dbxAction` directives.
 *
 * This allows a child action context to bind to an action that was registered elsewhere
 * in the template via {@link DbxActionMapSourceDirective}.
 *
 * @example
 * ```html
 * <div dbxActionContextMap>
 *   <div dbxAction [dbxActionMapSource]="'myAction'">...</div>
 *   <!-- Consume the registered action elsewhere in the tree -->
 *   <div [dbxActionFromMap]="'myAction'">
 *     <div dbxAction>
 *       <div *dbxActionHasSuccess>Done!</div>
 *     </div>
 *   </div>
 * </div>
 * ```
 *
 * @see {@link DbxActionContextMapDirective} for the parent map provider.
 * @see {@link DbxActionMapSourceDirective} for registering an action into the map.
 */
@Directive({
  selector: '[dbxActionFromMap]',
  providers: provideSecondaryActionStoreSource(DbxActionFromMapDirective),
  standalone: true
})
export class DbxActionFromMapDirective implements SecondaryActionContextStoreSource {
  private readonly _actionContextStoreSourceMap = inject(ActionContextStoreSourceMap);

  readonly key = input<Maybe<ActionKey>>(undefined, { alias: 'dbxActionFromMap' });
  readonly key$ = toObservable(this.key);

  readonly store$ = this.key$.pipe(
    filterMaybe(),
    switchMap((x) => this._actionContextStoreSourceMap.sourceForKey(x).store$)
  );
}
