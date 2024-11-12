import { FilterSource, FilterSourceConnector } from '@dereekb/rxjs';
import { DbxFilterButtonConfig } from '@dereekb/dbx-web';
import { Component, Input, inject } from '@angular/core';
import { DocInteractionTestFilterCustomFilterComponent } from './filter.custom.component';
import { DocInteractionTestFilterPresetFilterComponent } from './filter.preset.component';
import { DocInteractionTestFilter } from './filter';
import { DbxButtonDisplayContent } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';

@Component({
  selector: 'doc-interaction-test-filter-popover-button',
  template: `
    <dbx-filter-popover-button [buttonDisplay]="buttonDisplay" [config]="config" [disabled]="disabled"></dbx-filter-popover-button>
  `
})
export class DocInteractionTestFilterPopoverButtonComponent {
  readonly filterSourceConnector = inject(FilterSourceConnector);
  readonly filterSource = inject(FilterSource<DocInteractionTestFilter>);

  @Input()
  disabled?: Maybe<boolean>;

  readonly config: DbxFilterButtonConfig<DocInteractionTestFilter> = {
    icon: 'settings',
    header: 'Custom Header',
    customFilterComponentClass: DocInteractionTestFilterCustomFilterComponent,
    presetFilterComponentClass: DocInteractionTestFilterPresetFilterComponent,
    connector: this.filterSourceConnector,
    initialFilterObs: this.filterSource.filter$
  };

  @Input()
  buttonDisplay?: Maybe<DbxButtonDisplayContent>;
}
