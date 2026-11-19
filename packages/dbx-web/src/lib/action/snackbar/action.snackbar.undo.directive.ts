import { Directive, input } from '@angular/core';
import { type Work } from '@dereekb/rxjs';
import { type GetterOrValue, type Maybe, type Milliseconds } from '@dereekb/util';
import { type DbxActionSnackbarGeneratorUndoInputConfig } from './action.snackbar.generator';
import { type DbxActionSnackbarUndoSource, dbxActionSnackbarUndoWork, provideDbxActionSnackbarUndoSource } from './action.snackbar.undo';

/**
 * Offers "Undo" in the action snackbar after the action succeeds. The caller hands over only the undo work and its value.
 *
 * Used beside `dbxActionSnackbar`, it is the one way a list or gallery item (or any action host) offers "Deleted · Undo". dbx-web owns:
 * - building the one-time undo action, which keeps working after the item that offered it is destroyed;
 * - the undo window (`dbxActionSnackbarUndoDuration`, defaulting to the snackbar service's `defaultUndoDuration` of 10 seconds);
 * - showing a refused undo in the snackbar, where it can be retried or closed;
 * - cleaning up the undo action when Undo is never clicked.
 *
 * The work runs after the item may be gone, so it must not depend on the item's own injector; bind work owned by the page or a store.
 * The value is read once, when the action succeeds. Only one snackbar shows at a time, so a newer snackbar ends the offer.
 *
 * An explicit `[dbxActionSnackbarUndo]` on the same element wins over this directive.
 *
 * @dbxWebComponent
 * @dbxWebSlug action-snackbar-undo
 * @dbxWebCategory action
 * @dbxWebRelated action-snackbar, action-snackbar-error, error
 * @dbxWebSkillRefs dbx__ref__dbx-component-patterns
 * @dbxWebMinimalExample ```html
 * <div dbxAction dbxActionValue [dbxActionHandler]="handleDelete" dbxActionSnackbar dbxActionSnackbarDefault="delete" [dbxActionSnackbarUndoWork]="handleRestore" [dbxActionSnackbarUndoValue]="item.id">
 *   <dbx-button dbxActionButton text="Delete"></dbx-button>
 * </div>
 * ```
 *
 * @dbxAction
 * @dbxActionSlug snackbar-undo
 * @dbxActionRole directive
 * @dbxActionStateInteraction RESOLVED
 * @dbxActionConsumesContext
 *
 * @example
 * ```html
 * <div dbxAction dbxActionValue [dbxActionHandler]="handleDelete" dbxActionSnackbar dbxActionSnackbarDefault="delete" [dbxActionSnackbarUndoWork]="handleRestore" [dbxActionSnackbarUndoValue]="item.id">
 *   <dbx-button dbxActionButton text="Delete"></dbx-button>
 * </div>
 * ```
 *
 * ```ts
 * // on the page that owns the list, so it outlives the deleted item
 * readonly handleRestore: WorkUsingObservable<string, void> = (id) => this.store.restoreRequest(id);
 * ```
 */
@Directive({
  selector: '[dbxActionSnackbar][dbxActionSnackbarUndoWork]',
  providers: provideDbxActionSnackbarUndoSource(DbxActionSnackbarUndoWorkDirective)
})
export class DbxActionSnackbarUndoWorkDirective<V = unknown, R = unknown> implements DbxActionSnackbarUndoSource<unknown, R> {
  /**
   * Work that runs when Undo is clicked.
   */
  readonly dbxActionSnackbarUndoWork = input<Maybe<Work<V, R>>>();
  /**
   * Value passed to the undo work, such as the id of the deleted item. Read once, when the action succeeds.
   */
  readonly dbxActionSnackbarUndoValue = input<Maybe<GetterOrValue<V>>>();
  /**
   * How long Undo is offered.
   */
  readonly dbxActionSnackbarUndoDuration = input<Maybe<Milliseconds>>();

  snackbarUndoInput(): Maybe<DbxActionSnackbarGeneratorUndoInputConfig<unknown, R>> {
    const work = this.dbxActionSnackbarUndoWork();
    return work ? dbxActionSnackbarUndoWork<V, R>({ work, value: this.dbxActionSnackbarUndoValue(), duration: this.dbxActionSnackbarUndoDuration() }) : undefined;
  }
}
