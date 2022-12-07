import { Component } from '@angular/core';
import { AbstractFilterSourceDirective, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { DocInteractionTestFilter } from './filter';

@Component({
  selector: 'doc-interaction-test-filter-custom-filter',
  templateUrl: './filter.custom.component.html',
  providers: [provideFilterSourceDirective(DocInteractionTestFilterCustomFilterComponent)]
})
export class DocInteractionTestFilterCustomFilterComponent extends AbstractFilterSourceDirective<DocInteractionTestFilter> {
  override defaultFilterValue = {};
}
