import { Component } from '@angular/core';
import { AbstractFilterSourceDirective, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { DocInteractionTestFilter, DOC_INTERACTION_TEST_FULL_AND_PARTIAL_PRESETS } from './filter';
import { DbxPresetFilterListComponent } from '../../../../../../../../../packages/dbx-web/src/lib/interaction/filter/filter.preset.list.component';

@Component({
    selector: 'doc-interaction-test-filter-preset-filter',
    template: '<dbx-preset-filter-list [presets]="presets"></dbx-preset-filter-list>',
    providers: [provideFilterSourceDirective(DocInteractionTestFilterPresetFilterComponent)],
    standalone: true,
    imports: [DbxPresetFilterListComponent]
})
export class DocInteractionTestFilterPresetFilterComponent extends AbstractFilterSourceDirective<DocInteractionTestFilter> {
  readonly presets = DOC_INTERACTION_TEST_FULL_AND_PARTIAL_PRESETS;
}
