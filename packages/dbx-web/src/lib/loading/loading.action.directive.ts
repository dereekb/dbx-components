import { cleanLoadingContext, DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';
import { Directive, inject } from '@angular/core';
import { DbxLoadingComponent } from './loading.component';

/**
 * Context used for linking a loadingComponent to an ActionContext by providing a LoadingContext.
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
