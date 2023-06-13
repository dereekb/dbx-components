import { Component } from '@angular/core';
import { ClickableFilterPreset, AbstractFilterSourceDirective, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { DocInteractionTestFilter, DOC_INTERACTION_TEST_PRESETS } from './filter';

@Component({
  selector: 'doc-interaction-test-date-filter-preset-filter',
  template: `
    <dbx-preset-filter-list [presets]="presets">
      <div></div>
    </dbx-preset-filter-list>
  `,
  providers: [provideFilterSourceDirective(DocInteractionTestDateFilterPresetFilterComponent)]
})
export class DocInteractionTestDateFilterPresetFilterComponent extends AbstractFilterSourceDirective<DocInteractionTestFilter> {
  readonly presets: ClickableFilterPreset<DocInteractionTestFilter>[] = DOC_INTERACTION_TEST_PRESETS;
}
