import { FilterSource, FilterSourceConnector } from '@dereekb/rxjs';
import { type DbxFilterButtonConfig, type DbxButtonDisplayStylePair, DbxFilterPopoverButtonComponent } from '@dereekb/dbx-web';
import { Component, inject, input } from '@angular/core';
import { type DocInteractionTestFilter } from './filter';
import { type Maybe } from '@dereekb/util';
import { DocInteractionTestDateFilterPresetFilterComponent } from './filter.date.preset.component';
import { DocInteractionTestDateFilterCustomFilterComponent } from './filter.date.custom.component';

@Component({
  selector: 'doc-interaction-test-date-filter-popover-button',
  template: `
    <dbx-filter-popover-button [buttonDisplayStyle]="buttonDisplayStyle()" [config]="config"></dbx-filter-popover-button>
  `,
  imports: [DbxFilterPopoverButtonComponent]
})
export class DocInteractionTestDateFilterPopoverButtonComponent {
  readonly filterSourceConnector = inject(FilterSourceConnector);
  readonly filterSource = inject(FilterSource<DocInteractionTestFilter>);

  readonly buttonDisplayStyle = input<Maybe<DbxButtonDisplayStylePair>>();

  /**
   * Picking a preset closes the popover. The "Custom" button, in the header and below the presets, switches to the date range editor, which applies each change right away and stays open until Save. The buttons show both in the header and below the content.
   */
  readonly config: DbxFilterButtonConfig<DocInteractionTestFilter> = {
    icon: 'calendar_today',
    header: 'Date Range',
    customizeButtonText: 'Custom',
    showButtonsBelowContent: true,
    closeButtonText: 'Save',
    presetFilterComponentConfig: {
      componentClass: DocInteractionTestDateFilterPresetFilterComponent
    },
    customFilterComponentClass: DocInteractionTestDateFilterCustomFilterComponent,
    closeOnCustomFilterChange: false,
    height: '800px',
    connector: this.filterSourceConnector,
    initialFilterObs: this.filterSource.filter$
  };
}
