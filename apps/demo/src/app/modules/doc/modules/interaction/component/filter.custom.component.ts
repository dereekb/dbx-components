import { Component } from '@angular/core';
import { AbstractFilterSourceDirective, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { DocInteractionTestFilter } from './filter';

const DEFAULT_FILTER_VALUE: DocInteractionTestFilter = {};

@Component({
  selector: 'doc-interaction-test-filter-custom-filter',
  templateUrl: './filter.custom.component.html',
  providers: [provideFilterSourceDirective(DocInteractionTestFilterCustomFilterComponent, () => DEFAULT_FILTER_VALUE)]
})
export class DocInteractionTestFilterCustomFilterComponent extends AbstractFilterSourceDirective<DocInteractionTestFilter> {}
