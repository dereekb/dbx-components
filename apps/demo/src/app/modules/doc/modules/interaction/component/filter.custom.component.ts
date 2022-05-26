import { Component } from '@angular/core';
import { AbstractActionFilterSourceDirective } from '@dereekb/dbx-core';
import { DocInteractionTestFilter } from './filter';

@Component({
  selector: 'doc-interaction-test-filter-custom-filter',
  templateUrl: './filter.custom.component.html'
})
export class DocInteractionTestFilterCustomFilterComponent extends AbstractActionFilterSourceDirective<DocInteractionTestFilter> {}
