import { Component } from '@angular/core';
import { type ClickableFilterPreset, AbstractFilterSourceDirective, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { type DocInteractionTestFilter, DOC_INTERACTION_DATE_TEST_PRESETS } from './filter';
import { DbxPresetFilterListComponent } from '@dereekb/dbx-web';

/**
 * Preset date filter for the date filter popover. Picking a preset closes the popover.
 */
@Component({
  selector: 'doc-interaction-test-date-filter-preset-filter',
  template: `
    <dbx-preset-filter-list [presets]="presets"></dbx-preset-filter-list>
  `,
  providers: [provideFilterSourceDirective(DocInteractionTestDateFilterPresetFilterComponent)],
  imports: [DbxPresetFilterListComponent]
})
export class DocInteractionTestDateFilterPresetFilterComponent extends AbstractFilterSourceDirective<DocInteractionTestFilter> {
  readonly presets: ClickableFilterPreset<DocInteractionTestFilter>[] = DOC_INTERACTION_DATE_TEST_PRESETS;
}
