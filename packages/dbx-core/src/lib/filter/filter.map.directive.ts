import { Directive, inject } from '@angular/core';
import { FilterMap } from '@dereekb/rxjs';
import { clean } from '../rxjs/clean';

/**
 * Directive that provides a {@link FilterMap} instance for managing multiple named filter sources.
 *
 * Child directives like `dbxFilterMapSource` and `dbxFilterMapSourceConnector` look up this
 * map via DI to register and retrieve filter instances by key.
 *
 * @example
 * ```html
 * <div dbxFilterMap>
 *   <div [dbxFilterMapSource]="'listA'">...</div>
 *   <div [dbxFilterMapSource]="'listB'">...</div>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxFilterMap]',
  exportAs: 'dbxFilterMap',
  providers: [FilterMap],
  standalone: true
})
export class DbxFilterMapDirective<F> {
  readonly filterMap = clean(inject(FilterMap<F>));
}
