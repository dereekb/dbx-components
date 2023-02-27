import { FilterSource, FilterSourceConnector } from '@dereekb/rxjs';
import { DbxFilterButtonConfig } from '@dereekb/dbx-web';
import { Component, Input } from '@angular/core';
import { DocInteractionTestFilterCustomFilterComponent } from './filter.custom.component';
import { DocInteractionTestFilterPresetFilterComponent } from './filter.preset.component';
import { DocInteractionTestFilter } from './filter';
import { DbxButtonDisplayContent } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';

@Component({
  selector: 'doc-interaction-test-filter-popover-button',
  template: `
    <dbx-filter-popover-button [buttonDisplay]="buttonDisplay" [config]="config"></dbx-filter-popover-button>
  `
})
export class DocInteractionTestFilterPopoverButtonComponent {
  readonly config: DbxFilterButtonConfig<DocInteractionTestFilter> = {
    customFilterComponentClass: DocInteractionTestFilterCustomFilterComponent,
    presetFilterComponentClass: DocInteractionTestFilterPresetFilterComponent,
    connector: this.filterSourceConnector,
    initialFilterObs: this.filterSource.filter$
  };

  constructor(readonly filterSourceConnector: FilterSourceConnector, readonly filterSource: FilterSource<DocInteractionTestFilter>) {}

  @Input()
  buttonDisplay?: Maybe<DbxButtonDisplayContent>;
}
