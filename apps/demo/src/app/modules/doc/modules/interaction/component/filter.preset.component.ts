import { addDays, startOfDay } from 'date-fns';
import { BehaviorSubject } from 'rxjs';
import { Component } from '@angular/core';
import { AbstractFilterSourceDirective, ClickableAnchor, provideActionStoreSource, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { DocInteractionTestFilter } from './filter';
import { ClickableFilterPreset } from '@dereekb/dbx-web';

@Component({
  selector: 'doc-interaction-test-filter-preset-filter',
  template: '<dbx-preset-filter-list [presets]="presets"></dbx-preset-filter-list>',
  providers: [provideFilterSourceDirective(DocInteractionTestFilterPresetFilterComponent)]
})
export class DocInteractionTestFilterPresetFilterComponent extends AbstractFilterSourceDirective<DocInteractionTestFilter> {
  readonly presets: ClickableFilterPreset<DocInteractionTestFilter>[] = [
    {
      title: 'John Doe',
      preset: 'johndoe',
      presetValue: {
        name: 'John Doe'
      }
    },
    {
      title: 'Today',
      preset: 'today',
      presetValue: {
        date: startOfDay(new Date())
      }
    },
    {
      title: 'Tomorrow',
      preset: 'tomorrow',
      presetValue: {
        date: startOfDay(addDays(new Date(), 1))
      }
    }
  ];
}
