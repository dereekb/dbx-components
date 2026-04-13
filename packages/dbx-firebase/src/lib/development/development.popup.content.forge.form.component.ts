import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractConfigAsyncForgeFormDirective, DBX_FORGE_FORM_COMPONENT_TEMPLATE, dbxForgeFormComponentProviders, DbxForgeFormComponentImportsModule, forgePickableChipField, filterPickableItemFieldValuesByLabel, type SearchableValueFieldDisplayFn, type SearchableValueFieldDisplayValue, type SearchableValueFieldValue } from '@dereekb/dbx-form';
import { type Maybe } from '@dereekb/util';
import type { FormConfig } from '@ng-forge/dynamic-forms';
import { map, type Observable, of } from 'rxjs';
import { type DbxFirebaseDevelopmentWidgetEntry } from './development.widget';

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

/**
 * Forge form component for selecting development widget entries from a popup.
 */
@Component({
  selector: 'dbx-firebase-development-popup-content-forge-form',
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  imports: [DbxForgeFormComponentImportsModule],
  providers: dbxForgeFormComponentProviders(),
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseDevelopmentPopupContentForgeFormComponent extends AbstractConfigAsyncForgeFormDirective<DbxFirebaseDevelopmentPopupContentFormValue, DbxFirebaseDevelopmentPopupContentFormInput> {
  readonly config$: Observable<Maybe<FormConfig>> = this.currentConfig$.pipe(
    map((config) => {
      if (!config) {
        return undefined;
      }

      return {
        fields: [
          forgePickableChipField<string, DbxFirebaseDevelopmentWidgetEntry>({
            key: 'specifier',
            hint: 'Pick a tool to get started.',
            props: {
              filterLabel: 'Tools',
              filterValues: filterPickableItemFieldValuesByLabel,
              loadValues: () => of(config.entries.map((y) => ({ value: y.widget.type, meta: y }))),
              displayForValue: DISPLAY_FOR_DEVELOPMENT_POPUP_STRING_VALUE,
              asArrayValue: false
            }
          })
        ]
      };
    })
  );
}
