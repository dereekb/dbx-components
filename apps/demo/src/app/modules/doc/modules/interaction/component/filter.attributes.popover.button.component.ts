import { FilterSource, FilterSourceConnector } from '@dereekb/rxjs';
import { type DbxFilterButtonConfigWithCustomFilter, type DbxButtonDisplayStylePair, DbxFilterPopoverButtonComponent } from '@dereekb/dbx-web';
import { Component, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DocInteractionTestMergedFilter } from './filter';
import { DocInteractionTestAttributesFilterComponent } from './filter.attributes.component';

/**
 * Filter popover button for the "attributes" fields of a DocInteractionTestMergedFilter.
 *
 * Used alongside the date filter popover button, with each button owning its own FilterMap key.
 */
@Component({
  selector: 'doc-interaction-test-attributes-filter-popover-button',
  template: `
    <dbx-filter-popover-button [buttonDisplayStyle]="buttonDisplayStyle()" [config]="config"></dbx-filter-popover-button>
  `,
  imports: [DbxFilterPopoverButtonComponent]
})
export class DocInteractionTestAttributesFilterPopoverButtonComponent {
  readonly filterSourceConnector = inject(FilterSourceConnector);
  readonly filterSource = inject(FilterSource<DocInteractionTestMergedFilter>);

  readonly buttonDisplayStyle = input<Maybe<DbxButtonDisplayStylePair>>();

  readonly config: DbxFilterButtonConfigWithCustomFilter<DocInteractionTestMergedFilter> = {
    icon: 'tune',
    header: 'Filters',
    closeButtonText: 'Save',
    customFilterComponentClass: DocInteractionTestAttributesFilterComponent,
    showCloseButton: true,
    closeOnFilterChange: false,
    connector: this.filterSourceConnector,
    initialFilterObs: this.filterSource.filter$
  };
}
