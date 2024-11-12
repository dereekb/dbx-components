import { DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';
import { Directive, OnInit, OnDestroy, inject } from '@angular/core';
import { LoadingStateContextInstance } from '@dereekb/rxjs';
import { DbxLoadingComponent } from './loading.component';

/**
 * Context used for linking a loadingComponent to an ActionContext by providing a LoadingContext.
 */
@Directive({
  selector: '[dbxActionLoadingContext]'
})
export class DbxActionLoadingContextDirective implements OnInit, OnDestroy {
  readonly loadingComponent = inject(DbxLoadingComponent, { host: true });
  readonly source = inject(DbxActionContextStoreSourceInstance);

  private _context = new LoadingStateContextInstance({ obs: this.source.loadingState$ });

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
