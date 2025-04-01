import { DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';
import { Directive, OnInit, OnDestroy, inject } from '@angular/core';
import { DbxLoadingComponent } from './loading.component';
import { loadingStateContext } from '@dereekb/rxjs';

/**
 * Context used for linking a loadingComponent to an ActionContext by providing a LoadingContext.
 */
@Directive({
  selector: '[dbxActionLoadingContext]',
  standalone: true
})
export class DbxActionLoadingContextDirective implements OnInit, OnDestroy {
  readonly loadingComponent = inject(DbxLoadingComponent, { host: true });
  readonly source = inject(DbxActionContextStoreSourceInstance);

  private readonly _context = loadingStateContext({ obs: this.source.loadingState$ });

  get context() {
    return this._context;
  }

  ngOnInit(): void {
    this.loadingComponent.context = this._context;
  }

  ngOnDestroy(): void {
    this._context.destroy();
  }
}
