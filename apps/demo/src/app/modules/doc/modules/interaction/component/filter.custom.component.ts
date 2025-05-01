import { Component } from '@angular/core';
import { AbstractFilterSourceDirective, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { DocInteractionTestFilter } from './filter';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DbxFilterWrapperComponent } from '../../../../../../../../../packages/dbx-web/src/lib/interaction/filter/filter.wrapper.component';
import { DbxActionDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/context/action.directive';
import { DocInteractionTestFilterCustomFilterFormComponent } from './filter.custom.form.component';
import { DbxActionFormDirective } from '../../../../../../../../../packages/dbx-form/src/lib/form/action/form.action.directive';
import { DbxFormSourceDirective } from '../../../../../../../../../packages/dbx-form/src/lib/form/io/form.input.directive';

const DEFAULT_FILTER_VALUE: DocInteractionTestFilter = {};

@Component({
    selector: 'doc-interaction-test-filter-custom-filter',
    templateUrl: './filter.custom.component.html',
    providers: [provideFilterSourceDirective(DocInteractionTestFilterCustomFilterComponent, () => DEFAULT_FILTER_VALUE)],
    standalone: true,
    imports: [DbxContentContainerDirective, DbxFilterWrapperComponent, DbxActionDirective, DocInteractionTestFilterCustomFilterFormComponent, DbxActionFormDirective, DbxFormSourceDirective]
})
export class DocInteractionTestFilterCustomFilterComponent extends AbstractFilterSourceDirective<DocInteractionTestFilter> {}
