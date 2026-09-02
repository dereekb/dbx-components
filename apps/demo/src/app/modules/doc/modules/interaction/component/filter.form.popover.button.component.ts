import { FilterSource, FilterSourceConnector } from '@dereekb/rxjs';
import { type DbxFilterButtonConfigWithCustomFilter, type DbxButtonDisplayStylePair, DbxFilterPopoverButtonComponent } from '@dereekb/dbx-web';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DocInteractionTestFilterCustomFilterComponent } from './filter.custom.component';
import { type DocInteractionTestFilter } from './filter';
import { type Maybe } from '@dereekb/util';

/**
 * Filter popover button that configures only a custom filter component.
 *
 * Without a preset component the popover opens directly to the custom filter's form and hides the preset/customize switch buttons.
 */
@Component({
  selector: 'doc-interaction-test-form-filter-popover-button',
  template: `
    <dbx-filter-popover-button [buttonDisplayStyle]="buttonDisplayStyle()" [config]="config" [disabled]="disabled()"></dbx-filter-popover-button>
  `,
  standalone: true,
  imports: [DbxFilterPopoverButtonComponent]
})
export class DocInteractionTestFormFilterPopoverButtonComponent {
  readonly filterSourceConnector = inject(FilterSourceConnector);
  readonly filterSource = inject(FilterSource<DocInteractionTestFilter>);

  readonly buttonDisplayStyle = input<Maybe<DbxButtonDisplayStylePair>>();
  readonly disabled = input<Maybe<boolean>>();

  readonly config: DbxFilterButtonConfigWithCustomFilter<DocInteractionTestFilter> = {
    header: 'Filter',
    customFilterComponentClass: DocInteractionTestFilterCustomFilterComponent,
    connector: this.filterSourceConnector,
    initialFilterObs: this.filterSource.filter$
  };
}
