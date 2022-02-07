import { Directive, OnDestroy } from '@angular/core';
import { FilterMap } from '@dereekb/rxjs';

/**
 * Direction that provides an FilterMap.
 */
@Directive({
  selector: '[dbxFilterMap]',
  exportAs: 'dbxFilterMap',
  providers: [FilterMap]
})
export class DbxFilterMapDirective<F> implements OnDestroy {

  constructor(readonly filterMap: FilterMap<F>) { }

  ngOnDestroy(): void {
    this.filterMap.destroy();
  }

}
