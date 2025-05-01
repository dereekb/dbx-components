import { FilterSource, FilterSourceConnector } from '@dereekb/rxjs';
import { DbxFilterButtonConfig } from '@dereekb/dbx-web';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DocInteractionTestFilterCustomFilterComponent } from './filter.custom.component';
import { DocInteractionTestFilterPresetFilterComponent } from './filter.preset.component';
import { DocInteractionTestFilter } from './filter';
import { DbxButtonDisplay } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxFilterPopoverButtonComponent } from '../../../../../../../../../packages/dbx-web/src/lib/interaction/filter/filter.popover.button.component';

@Component({
    selector: 'doc-interaction-test-filter-popover-button',
    template: `
    <dbx-filter-popover-button [buttonDisplay]="buttonDisplay()" [config]="config" [disabled]="disabled()"></dbx-filter-popover-button>
  `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [DbxFilterPopoverButtonComponent]
})
export class DocInteractionTestFilterPopoverButtonComponent {
  readonly filterSourceConnector = inject(FilterSourceConnector);
  readonly filterSource = inject(FilterSource<DocInteractionTestFilter>);

  readonly buttonDisplay = input<Maybe<DbxButtonDisplay>>();
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
