import { FilterSource, FilterSourceConnector } from '@dereekb/rxjs';
import { DbxFilterButtonConfigWithPresetFilter } from '@dereekb/dbx-web';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DocInteractionTestFilter } from './filter';
import { DbxButtonDisplay } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DocInteractionTestDateFilterPresetFilterComponent } from './filter.date.preset.component';
import { DbxFilterPopoverButtonComponent } from '@dereekb/dbx-web';

@Component({
  selector: 'doc-interaction-test-date-filter-popover-button',
  template: `
    <dbx-filter-popover-button [buttonDisplay]="buttonDisplay()" [config]="config"></dbx-filter-popover-button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DbxFilterPopoverButtonComponent]
})
export class DocInteractionTestDateFilterPopoverButtonComponent {
  readonly filterSourceConnector = inject(FilterSourceConnector);
  readonly filterSource = inject(FilterSource<DocInteractionTestFilter>);

  readonly buttonDisplay = input<Maybe<DbxButtonDisplay>>();

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
}
