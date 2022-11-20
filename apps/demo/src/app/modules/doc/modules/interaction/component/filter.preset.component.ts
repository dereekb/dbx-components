import { addDays, startOfDay } from 'date-fns';
import { BehaviorSubject } from 'rxjs';
import { Component } from '@angular/core';
import { ClickableFilterPreset, AbstractFilterSourceDirective, ClickableAnchor, provideActionStoreSource, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { DocInteractionTestFilter, DOC_INTERACTION_TEST_PRESETS } from './filter';

@Component({
  selector: 'doc-interaction-test-filter-preset-filter',
  template: '<dbx-preset-filter-list [presets]="presets"></dbx-preset-filter-list>',
  providers: [provideFilterSourceDirective(DocInteractionTestFilterPresetFilterComponent)]
})
export class DocInteractionTestFilterPresetFilterComponent extends AbstractFilterSourceDirective<DocInteractionTestFilter> {
  readonly presets: ClickableFilterPreset<DocInteractionTestFilter>[] = DOC_INTERACTION_TEST_PRESETS;
}
