import { cleanLoadingContext, DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';
import { Directive, inject } from '@angular/core';
import { DbxLoadingComponent } from './loading.component';

/**
 * Links a {@link DbxLoadingComponent} to a {@link DbxActionContextStoreSourceInstance} by forwarding its loading state.
 *
 * Apply to a `<dbx-loading>` element that is within an action context to automatically
 * reflect the action's loading state in the loading component.
 *
 * @dbxWebComponent
 * @dbxWebSlug action-loading-context
 * @dbxWebCategory action
 * @dbxWebRelated loading, action-snackbar
 * @dbxWebSkillRefs dbx__ref__dbx-component-patterns
 * @dbxWebMinimalExample ```html
 * <button [dbxActionLoadingContext]></button>
 * ```
 *
 * @example
 * ```html
 * <dbx-loading [state]="ctx.state$ | async">
 *   <button [dbxAction]="saveAction" dbxActionLoadingContext>Save</button>
 * </dbx-loading>
 * ```
 */
@Directive({
  selector: '[dbxActionLoadingContext]',
  standalone: true
})
export class DbxActionLoadingContextDirective {
  readonly loadingComponent = inject(DbxLoadingComponent, { host: true });

  readonly source = inject(DbxActionContextStoreSourceInstance);

  private readonly _context = cleanLoadingContext({ obs: this.source.loadingState$ });

  constructor() {
    this.loadingComponent.setContext(this._context);
  }
}
