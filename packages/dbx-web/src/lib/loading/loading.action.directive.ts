import { DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';
import { Directive, Host, OnInit, OnDestroy } from '@angular/core';
import { LoadingStateContextInstance } from '@dereekb/rxjs';
import { DbxLoadingComponent } from './loading.component';

/**
 * Context used for linking a loadingComponent to an ActionContext by providing a LoadingContext.
 */
@Directive({
  selector: '[dbxActionLoadingContext]'
})
export class DbxActionLoadingContextDirective implements OnInit, OnDestroy {
  private _context = new LoadingStateContextInstance({ obs: this.source.loadingState$ });

  constructor(@Host() readonly loadingComponent: DbxLoadingComponent, readonly source: DbxActionContextStoreSourceInstance) {}

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
