import { FilterSource, FilterSourceConnector } from '@dereekb/rxjs';
import { type DbxFilterButtonConfig, type DbxButtonDisplayStylePair, DbxFilterPopoverButtonComponent } from '@dereekb/dbx-web';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DocInteractionTestFilterCustomFilterComponent } from './filter.custom.component';
import { DocInteractionTestFilterPresetFilterComponent } from './filter.preset.component';
import { type DocInteractionTestFilter } from './filter';
import { type Maybe } from '@dereekb/util';

@Component({
  selector: 'doc-interaction-test-filter-popover-button',
  template: `
    <dbx-filter-popover-button [buttonDisplayStyle]="buttonDisplayStyle()" [config]="config" [disabled]="disabled()"></dbx-filter-popover-button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [DbxFilterPopoverButtonComponent]
})
export class DocInteractionTestFilterPopoverButtonComponent {
  readonly filterSourceConnector = inject(FilterSourceConnector);
  readonly filterSource = inject(FilterSource<DocInteractionTestFilter>);

  readonly buttonDisplayStyle = input<Maybe<DbxButtonDisplayStylePair>>();
  readonly disabled = input<Maybe<boolean>>();

  readonly config: DbxFilterButtonConfig<DocInteractionTestFilter> = {
    icon: 'settings',
    header: 'Custom Header',
    customFilterComponentClass: DocInteractionTestFilterCustomFilterComponent,
    presetFilterComponentClass: DocInteractionTestFilterPresetFilterComponent,
    connector: this.filterSourceConnector,
    initialFilterObs: this.filterSource.filter$
  };
}
