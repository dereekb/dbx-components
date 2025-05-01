import { Component } from '@angular/core';
import { AbstractFilterSourceDirective, provideFilterSourceDirective, DbxActionDirective } from '@dereekb/dbx-core';
import { DocInteractionTestFilter } from './filter';
import { DbxContentContainerDirective, DbxFilterWrapperComponent } from '@dereekb/dbx-web';
import { DocInteractionTestFilterCustomFilterFormComponent } from './filter.custom.form.component';
import { DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';

const DEFAULT_FILTER_VALUE: DocInteractionTestFilter = {};

@Component({
  selector: 'doc-interaction-test-filter-custom-filter',
  templateUrl: './filter.custom.component.html',
  providers: [provideFilterSourceDirective(DocInteractionTestFilterCustomFilterComponent, () => DEFAULT_FILTER_VALUE)],
  standalone: true,
  imports: [DbxContentContainerDirective, DbxFilterWrapperComponent, DbxActionDirective, DocInteractionTestFilterCustomFilterFormComponent, DbxActionFormDirective, DbxFormSourceDirective]
})
export class DocInteractionTestFilterCustomFilterComponent extends AbstractFilterSourceDirective<DocInteractionTestFilter> {}
