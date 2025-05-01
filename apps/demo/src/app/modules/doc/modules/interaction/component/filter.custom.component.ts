import { Component } from '@angular/core';
import { AbstractFilterSourceDirective, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { DocInteractionTestFilter } from './filter';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DbxFilterWrapperComponent } from '@dereekb/dbx-web';
import { DbxActionDirective } from '@dereekb/dbx-core';
import { DocInteractionTestFilterCustomFilterFormComponent } from './filter.custom.form.component';
import { DbxActionFormDirective } from '@dereekb/dbx-form';
import { DbxFormSourceDirective } from '@dereekb/dbx-form';

const DEFAULT_FILTER_VALUE: DocInteractionTestFilter = {};

@Component({
  selector: 'doc-interaction-test-filter-custom-filter',
  templateUrl: './filter.custom.component.html',
  providers: [provideFilterSourceDirective(DocInteractionTestFilterCustomFilterComponent, () => DEFAULT_FILTER_VALUE)],
  standalone: true,
  imports: [DbxContentContainerDirective, DbxFilterWrapperComponent, DbxActionDirective, DocInteractionTestFilterCustomFilterFormComponent, DbxActionFormDirective, DbxFormSourceDirective]
})
export class DocInteractionTestFilterCustomFilterComponent extends AbstractFilterSourceDirective<DocInteractionTestFilter> {}
