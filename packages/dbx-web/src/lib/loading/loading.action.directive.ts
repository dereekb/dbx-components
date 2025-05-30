import { DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';
import { Directive, OnDestroy, inject } from '@angular/core';
import { DbxLoadingComponent } from './loading.component';
import { loadingStateContext } from '@dereekb/rxjs';

/**
 * Context used for linking a loadingComponent to an ActionContext by providing a LoadingContext.
 */
@Directive({
  selector: '[dbxActionLoadingContext]',
  standalone: true
})
export class DbxActionLoadingContextDirective implements OnDestroy {
  readonly loadingComponent = inject(DbxLoadingComponent, { host: true });

  readonly source = inject(DbxActionContextStoreSourceInstance);

  private readonly _context = loadingStateContext({ obs: this.source.loadingState$ });

  constructor() {
    this.loadingComponent.setContext(this._context);
  }

  ngOnDestroy(): void {
    this._context.destroy();
  }
}
