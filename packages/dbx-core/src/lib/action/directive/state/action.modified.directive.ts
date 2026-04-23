import { Directive, inject } from '@angular/core';
import { shareReplay } from 'rxjs';
import { AbstractIfDirective } from '../../../view/if.directive';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * Structural directive that conditionally renders its content when the action is marked as modified.
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <div *dbxActionIsModified>You have unsaved changes.</div>
 * </div>
 * ```
 *
 * @see {@link DbxActionEnforceModifiedDirective} for disabling the action when not modified.
 * @see {@link DbxActionAutoModifyDirective} for always keeping the action modified.
 */
@Directive({
  selector: '[dbxActionIsModified]',
  standalone: true
})
export class DbxActionIsModifiedDirective extends AbstractIfDirective {
  private readonly _store = inject(DbxActionContextStoreSourceInstance);

  readonly show$ = this._store.isModified$.pipe(shareReplay(1));
}
