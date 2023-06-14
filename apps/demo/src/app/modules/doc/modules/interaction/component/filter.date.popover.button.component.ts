import { FilterSource, FilterSourceConnector } from '@dereekb/rxjs';
import { DbxFilterButtonConfig } from '@dereekb/dbx-web';
import { Component, Input } from '@angular/core';
import { DocInteractionTestFilter } from './filter';
import { DbxButtonDisplayContent } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';
import { DocInteractionTestDateFilterPresetFilterComponent } from './filter.date.preset.component';

@Component({
  selector: 'doc-interaction-test-date-filter-popover-button',
  template: `
    <dbx-filter-popover-button [buttonDisplay]="buttonDisplay" [config]="config"></dbx-filter-popover-button>
  `
})
export class DocInteractionTestDateFilterPopoverButtonComponent {
  readonly config: DbxFilterButtonConfig<DocInteractionTestFilter> = {
    icon: 'event',
    header: 'Filter Date Range',
    presetFilterComponentClass: DocInteractionTestDateFilterPresetFilterComponent,
    height: '560px',
    closeOnFilterChange: false,
    connector: this.filterSourceConnector,
    initialFilterObs: this.filterSource.filter$
  };

  constructor(readonly filterSourceConnector: FilterSourceConnector, readonly filterSource: FilterSource<DocInteractionTestFilter>) {}

  @Input()
  buttonDisplay?: Maybe<DbxButtonDisplayContent>;
}
