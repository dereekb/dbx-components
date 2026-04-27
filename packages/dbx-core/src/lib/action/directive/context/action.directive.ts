import { Directive, inject } from '@angular/core';
import { SecondaryActionContextStoreSource } from '../../action.store.source';
import { provideActionStoreSource } from '../../action.store.source.provide';
import { DbxActionContextBaseSource } from '../../action.holder';
import { clean } from '../../../rxjs/clean';

/**
 * Core directive that creates and provides an action context for its host element and descendants.
 *
 * This is the root of the action system in templates. It creates an {@link ActionContextStore}
 * and provides it (along with the related source tokens) via Angular's dependency injection,
 * making the action lifecycle available to all child action directives.
 *
 * If a {@link SecondaryActionContextStoreSource} is available on the host, the directive will
 * reuse that store instead of creating its own, enabling action context forwarding.
 *
 * On destruction, the directive coordinates cleanup through a {@link LockSet} to ensure
 * in-flight operations complete before the store is torn down.
 *
 * @dbxAction
 * @dbxActionSlug action
 * @dbxActionStateInteraction IDLE
 * @dbxActionProducesContext
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <button (click)="action.trigger()">Submit</button>
 *   <div *dbxActionHasSuccess>Success!</div>
 *   <div *dbxActionWorking>Loading...</div>
 * </div>
 * ```
 *
 * @example
 * ```html
 * <!-- As an element -->
 * <dbx-action>
 *   <ng-container [dbxActionHandler]="handleAction">...</ng-container>
 * </dbx-action>
 * ```
 *
 * @typeParam T - The input value type for the action.
 * @typeParam O - The output result type for the action.
 *
 * @see {@link DbxActionSourceDirective} for forwarding an external action source.
 * @see {@link ActionContextStore} for the underlying state store.
 */
@Directive({
  selector: 'dbx-action,[dbxAction]',
  exportAs: 'action,dbxAction',
  providers: provideActionStoreSource(DbxActionDirective),
  standalone: true
})
export class DbxActionDirective<T = unknown, O = unknown> extends DbxActionContextBaseSource<T, O> {
  constructor() {
    super(inject(SecondaryActionContextStoreSource<T, O>, { optional: true, host: true }));

    // during cleaning/onDestroy, queue the lockset for cleanup
    clean(() => {
      this.lockSet.destroyOnNextUnlock(() => {
        this.destroy();
      });
    });
  }
}
