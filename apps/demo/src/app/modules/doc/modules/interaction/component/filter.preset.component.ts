import { Component } from '@angular/core';
import { AbstractActionFilterSourceDirective } from '@dereekb/dbx-core';
import { DocInteractionTestFilter } from './filter';

@Component({
  selector: 'doc-interaction-test-filter-preset-filter',
  templateUrl: './filter.preset.component.html'
})
export class DocInteractionTestFilterPresetFilterComponent extends AbstractActionFilterSourceDirective<DocInteractionTestFilter> { }
