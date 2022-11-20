import { Component, OnDestroy } from '@angular/core';
import { FilterMap, FilterMapKey } from '@dereekb/rxjs';
import { of } from 'rxjs';
import { DocInteractionTestFilter, DOC_INTERACTION_TEST_PRESETS } from '../component/filter';

@Component({
  templateUrl: './filter.component.html',
  providers: [FilterMap]
})
export class DocInteractionFilterComponent implements OnDestroy {
  readonly presets = DOC_INTERACTION_TEST_PRESETS;

  readonly buttonFilterKey: FilterMapKey = 'button';
  readonly menuFilterKey: FilterMapKey = 'menu';
  readonly listFilterKey: FilterMapKey = 'list';

  readonly filter$ = this.filterMap.filterForKey(this.buttonFilterKey);
  readonly menuFilter$ = this.filterMap.filterForKey(this.menuFilterKey);
  readonly listFilter$ = this.filterMap.filterForKey(this.listFilterKey);

  constructor(readonly filterMap: FilterMap<DocInteractionTestFilter>) {
    this.filterMap.addDefaultFilterObs(this.buttonFilterKey, of({}));
    this.filterMap.addDefaultFilterObs(this.menuFilterKey, of({}));
    this.filterMap.addDefaultFilterObs(this.listFilterKey, of({}));
  }

  ngOnDestroy(): void {
    this.filterMap.destroy();
  }
}
