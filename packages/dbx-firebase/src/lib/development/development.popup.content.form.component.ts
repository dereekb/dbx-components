import { Component } from '@angular/core';
import { AbstractConfigAsyncFormlyFormDirective, pickableItemChipField, filterPickableItemFieldValuesByLabel, SearchableValueFieldDisplayFn, SearchableValueFieldDisplayValue, SearchableValueFieldValue, FORMLY_FORM_COMPONENT_TEMPLATE } from '@dereekb/dbx-form';
import { type Maybe } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { map, Observable, of } from 'rxjs';
import { DbxFirebaseDevelopmentWidgetEntry } from './development.widget';

export interface DbxFirebaseDevelopmentPopupContentFormInput {
  readonly entries: DbxFirebaseDevelopmentWidgetEntry[];
}

export interface DbxFirebaseDevelopmentPopupContentFormValue {
  readonly specifier?: Maybe<string>;
}

const DISPLAY_FOR_DEVELOPMENT_POPUP_STRING_VALUE: SearchableValueFieldDisplayFn<string, DbxFirebaseDevelopmentWidgetEntry> = (values: SearchableValueFieldValue<string, DbxFirebaseDevelopmentWidgetEntry>[]) => {
  const displayValues: SearchableValueFieldDisplayValue<string, DbxFirebaseDevelopmentWidgetEntry>[] = values.map((x) => ({ ...x, label: x.meta?.label || x.value }));
  const obs: Observable<SearchableValueFieldDisplayValue<string, DbxFirebaseDevelopmentWidgetEntry>[]> = of(displayValues);
  return obs;
};

@Component({
  selector: 'dbx-firebase-development-popup-content-form',
  template: FORMLY_FORM_COMPONENT_TEMPLATE.template,
  imports: FORMLY_FORM_COMPONENT_TEMPLATE.imports,
  providers: FORMLY_FORM_COMPONENT_TEMPLATE.providers,
  changeDetection: FORMLY_FORM_COMPONENT_TEMPLATE.changeDetection,
  standalone: true
})
export class DbxFirebaseDevelopmentPopupContentFormComponent extends AbstractConfigAsyncFormlyFormDirective<DbxFirebaseDevelopmentPopupContentFormValue, DbxFirebaseDevelopmentPopupContentFormInput> {
  readonly fields$: Observable<FormlyFieldConfig[]> = this.config$.pipe(
    map((config: DbxFirebaseDevelopmentPopupContentFormInput) => {
      return [
        pickableItemChipField<string, DbxFirebaseDevelopmentWidgetEntry>({
          key: 'specifier',
          filterLabel: 'Tools',
          description: 'Pick a tool to get started.',
          filterValues: filterPickableItemFieldValuesByLabel,
          loadValues: () => of(config.entries.map((y) => ({ value: y.widget.type, meta: y }))),
          displayForValue: DISPLAY_FOR_DEVELOPMENT_POPUP_STRING_VALUE,
          asArrayValue: false
        })
      ];
    })
  );
}
