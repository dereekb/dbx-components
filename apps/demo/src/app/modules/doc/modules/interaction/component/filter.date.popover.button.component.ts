import { FilterSource, FilterSourceConnector } from '@dereekb/rxjs';
import { DbxFilterButtonConfigWithPresetFilter } from '@dereekb/dbx-web';
import { Component, Input, inject } from '@angular/core';
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
  readonly filterSourceConnector = inject(FilterSourceConnector);
  readonly filterSource = inject(FilterSource<DocInteractionTestFilter>);

  readonly config: DbxFilterButtonConfigWithPresetFilter<DocInteractionTestFilter, DocInteractionTestDateFilterPresetFilterComponent> = {
    icon: 'event',
    header: 'Filter Date Range',
    presetFilterComponentConfig: {
      componentClass: DocInteractionTestDateFilterPresetFilterComponent
    },
    showCloseButton: true,
    height: '560px',
    closeOnFilterChange: false,
    connector: this.filterSourceConnector,
    initialFilterObs: this.filterSource.filter$
  };

  @Input()
  buttonDisplay?: Maybe<DbxButtonDisplayContent>;
}
