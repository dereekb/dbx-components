import { Component } from '@angular/core';
import { provideFormlyContext, AbstractConfigAsyncFormlyFormDirective, pickableItemChipField, filterPickableItemFieldValuesByLabel, SearchableValueFieldDisplayFn, SearchableValueFieldDisplayValue, SearchableValueFieldValue } from '@dereekb/dbx-form';
import { Maybe } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { map, Observable, of } from 'rxjs';
import { DbxFirebaseDevelopmentWidgetEntry } from './development.widget';

export interface DbxFirebaseDevelopmentPopupContentFormInput {
  readonly entries: DbxFirebaseDevelopmentWidgetEntry[];
}

export interface DbxFirebaseDevelopmentPopupContentFormValue {
  readonly specifier?: Maybe<string>;
}

export const DISPLAY_FOR_STRING_VALUE: SearchableValueFieldDisplayFn<string, DbxFirebaseDevelopmentWidgetEntry> = (values: SearchableValueFieldValue<string, DbxFirebaseDevelopmentWidgetEntry>[]) => {
  const displayValues: SearchableValueFieldDisplayValue<string, DbxFirebaseDevelopmentWidgetEntry>[] = values.map((x) => ({ ...x, label: x.meta?.label || x.value }));
  const obs: Observable<SearchableValueFieldDisplayValue<string, DbxFirebaseDevelopmentWidgetEntry>[]> = of(displayValues);
  return obs;
};

@Component({
  template: `
    <dbx-formly></dbx-formly>
  `,
  selector: 'dbx-firebase-development-popup-content-form',
  providers: [provideFormlyContext()]
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
          displayForValue: DISPLAY_FOR_STRING_VALUE,
          asArrayValue: false
        })
      ];
    })
  );
}
