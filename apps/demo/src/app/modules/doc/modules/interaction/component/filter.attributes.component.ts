import { Component } from '@angular/core';
import { AbstractFilterSourceDirective, DbxActionAutoTriggerDirective, DbxActionEnforceModifiedDirective, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { type DbxActionFormMapValueFunction, DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { DbxFilterWrapperComponent } from '@dereekb/dbx-web';
import { docInteractionTestAttributesFilter, type DocInteractionTestMergedFilter } from './filter';
import { type DocInteractionTestAttributesFilterFormValue, DocInteractionTestAttributesFilterFormComponent } from './filter.attributes.form.component';

const DEFAULT_FILTER_VALUE: DocInteractionTestMergedFilter = {};

/**
 * Custom filter component that only edits the "attributes" fields of a DocInteractionTestMergedFilter.
 *
 * Changes are applied as soon as they are made.
 */
@Component({
  selector: 'doc-interaction-test-attributes-filter',
  template: `
    <dbx-filter-wrapper dbxActionEnforceModified dbxActionAutoTrigger useInstantTriggerPreset [showButtons]="false" style="display: block; padding: 12px 24px; overflow: hidden">
      <doc-interaction-test-attributes-filter-form dbxActionForm [dbxFormSource]="filter$" [dbxActionFormMapValue]="mapFormToFilterValue"></doc-interaction-test-attributes-filter-form>
    </dbx-filter-wrapper>
  `,
  providers: [provideFilterSourceDirective(DocInteractionTestAttributesFilterComponent, () => DEFAULT_FILTER_VALUE)],
  imports: [DbxFilterWrapperComponent, DbxActionEnforceModifiedDirective, DbxActionAutoTriggerDirective, DocInteractionTestAttributesFilterFormComponent, DbxActionFormDirective, DbxFormSourceDirective]
})
export class DocInteractionTestAttributesFilterComponent extends AbstractFilterSourceDirective<DocInteractionTestMergedFilter> {
  readonly mapFormToFilterValue: DbxActionFormMapValueFunction<DocInteractionTestAttributesFilterFormValue, DocInteractionTestMergedFilter> = (x) => ({ value: docInteractionTestAttributesFilter(x) });
}
