import { type DocInteractionTestCategory, DOC_INTERACTION_TEST_CATEGORY_OPTIONS, DOC_INTERACTION_TEST_MIN_PRICE_OPTIONS } from './filter';
import { Component } from '@angular/core';
import { AbstractSyncForgeFormDirective, DBX_FORGE_FORM_COMPONENT_TEMPLATE, dbxForgeFormComponentProviders, DbxForgeFormComponentImportsModule, dbxForgePickableChipField, dbxForgeValueSelectionField, pickableValueFieldValuesConfigForStaticLabeledValues } from '@dereekb/dbx-form';
import { type LabeledValue, type Maybe } from '@dereekb/util';
import type { FormConfig } from '@ng-forge/dynamic-forms';

export interface DocInteractionTestAttributesFilterFormValue {
  readonly minPrice?: Maybe<number>;
  readonly categories?: Maybe<DocInteractionTestCategory[]>;
}

@Component({
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  selector: 'doc-interaction-test-attributes-filter-form',
  providers: dbxForgeFormComponentProviders(),
  imports: [DbxForgeFormComponentImportsModule]
})
export class DocInteractionTestAttributesFilterFormComponent extends AbstractSyncForgeFormDirective<DocInteractionTestAttributesFilterFormValue> {
  readonly formConfig: FormConfig = {
    fields: [
      dbxForgeValueSelectionField<number>({ key: 'minPrice', label: 'Minimum Price', props: { options: DOC_INTERACTION_TEST_MIN_PRICE_OPTIONS } }),
      dbxForgePickableChipField<DocInteractionTestCategory, LabeledValue<DocInteractionTestCategory>>({ key: 'categories', label: 'Categories', props: pickableValueFieldValuesConfigForStaticLabeledValues(DOC_INTERACTION_TEST_CATEGORY_OPTIONS) })
    ]
  } as FormConfig;
}
