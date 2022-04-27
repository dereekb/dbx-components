import { DbxListViewWrapper } from '@dereekb/dbx-web';
import { Directive, Host } from "@angular/core";
import { DbxFirebaseModelLoader } from './model.loader';

/**
 * Directive that connects a host DbxFirebaseModelLoader into a DbxListView to pass data for rendering items from a collection and query parameters.
 */
@Directive({
  selector: '[dbxFirebaseModelLoaderList]'
})
export class DbxFirebaseModelLoaderListDirective<T> {

  constructor(@Host() readonly dbxListViewInputSource: DbxListViewWrapper<T>, @Host() readonly dbxModelLoader: DbxFirebaseModelLoader<T>) {
    this.dbxListViewInputSource.state$ = this.dbxModelLoader.pageLoadingState$;
  }

}
