import { Component, OnDestroy } from '@angular/core';
import { FilterMap, FilterMapKey } from '@dereekb/rxjs';
import { of } from 'rxjs';
import { DocInteractionTestFilter } from '../component/filter';

@Component({
  templateUrl: './filter.component.html',
  providers: [FilterMap]
})
export class DocInteractionFilterComponent implements OnDestroy {
  readonly buttonFilterKey: FilterMapKey = 'button';

  readonly filter$ = this.filterMap.filterForKey(this.buttonFilterKey);

  constructor(readonly filterMap: FilterMap<DocInteractionTestFilter>) {
    this.filterMap.addDefaultFilterObs(this.buttonFilterKey, of({}));
  }

  ngOnDestroy(): void {
    this.filterMap.destroy();
  }
}
