import { Directive, OnDestroy, inject } from '@angular/core';
import { FilterMap } from '@dereekb/rxjs';
import { clean } from '../rxjs/clean';

/**
 * Direction that provides a FilterMap.
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
