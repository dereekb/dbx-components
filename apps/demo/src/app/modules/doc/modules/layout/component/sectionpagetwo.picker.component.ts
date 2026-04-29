import { Component, ChangeDetectionStrategy } from '@angular/core';
import { dbxForgeFormComponentProviders, AbstractSyncForgeFormDirective, DBX_FORGE_FORM_COMPONENT_TEMPLATE, DbxForgeFormComponentImportsModule, dbxForgeSearchableTextField } from '@dereekb/dbx-form';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { of } from 'rxjs';
import { DISPLAY_FOR_STRING_VALUE, makeSearchForStringValue } from '../../form/container/selection.component';

export interface DocLayoutSectionPageTwoSearchValue {
  search: string;
}

@Component({
  selector: 'doc-layout-section-page-two-search',
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  providers: dbxForgeFormComponentProviders(),
  imports: [DbxForgeFormComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocLayoutSectionPageTwoSearchComponent extends AbstractSyncForgeFormDirective<DocLayoutSectionPageTwoSearchValue> {
  readonly formConfig: FormConfig = {
    fields: [
      dbxForgeSearchableTextField({
        key: 'search',
        placeholder: 'Search Values',
        props: {
          searchLabel: 'Search Values',
          allowStringValues: true,
          searchOnEmptyText: true,
          search: makeSearchForStringValue(of((searchString: string) => ['', searchString])),
          displayForValue: DISPLAY_FOR_STRING_VALUE,
          showSelectedValue: false,
          showClearValue: false
        }
      })
    ]
  };
}
