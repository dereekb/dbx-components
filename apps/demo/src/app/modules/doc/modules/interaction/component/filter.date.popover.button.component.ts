import { FilterSource, FilterSourceConnector } from '@dereekb/rxjs';
import { type DbxFilterButtonConfigWithPresetFilter, type DbxButtonDisplayStylePair, DbxFilterPopoverButtonComponent } from '@dereekb/dbx-web';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { type DocInteractionTestFilter } from './filter';
import { type Maybe } from '@dereekb/util';
import { DocInteractionTestDateFilterPresetFilterComponent } from './filter.date.preset.component';

@Component({
  selector: 'doc-interaction-test-date-filter-popover-button',
  template: `
    <dbx-filter-popover-button [buttonDisplayStyle]="buttonDisplayStyle()" [config]="config"></dbx-filter-popover-button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DbxFilterPopoverButtonComponent]
})
export class DocInteractionTestDateFilterPopoverButtonComponent {
  readonly filterSourceConnector = inject(FilterSourceConnector);
  readonly filterSource = inject(FilterSource<DocInteractionTestFilter>);

  readonly buttonDisplayStyle = input<Maybe<DbxButtonDisplayStylePair>>();

  readonly config: DbxFilterButtonConfigWithPresetFilter<DocInteractionTestFilter, DocInteractionTestDateFilterPresetFilterComponent> = {
    icon: 'calendar_today',
    header: 'Date Range',
    closeButtonText: 'Save',
    presetFilterComponentConfig: {
      componentClass: DocInteractionTestDateFilterPresetFilterComponent
    },
    showCloseButton: true,
    height: '800px',
    closeOnFilterChange: false,
    connector: this.filterSourceConnector,
    initialFilterObs: this.filterSource.filter$
  };
}
