import { Component } from '@angular/core';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { AbstractDbxSearchableValueFieldDirective, SearchableValueFieldsFieldConfig, SearchableValueFieldsFormlyFieldConfig } from './searchable.field.directive';

export interface SearchableTextValueFieldsFieldConfig<T> extends SearchableValueFieldsFieldConfig<T> { }
export interface SearchableTextValueFieldsFormlyFieldConfig<T> extends SearchableTextValueFieldsFieldConfig<T>, SearchableValueFieldsFormlyFieldConfig<T> { }

/**
 * Display component for selecting a single item/value.
 */
@Component({
  templateUrl: 'searchable.text.field.component.html'
})
export class DbxSearchableTextFieldComponent<T> extends AbstractDbxSearchableValueFieldDirective<T, SearchableTextValueFieldsFormlyFieldConfig<T>> {

  override readonly multiSelect = false;

  selected(event: any): void {
    const e: MatAutocompleteSelectedEvent = event;
    this.addWithDisplayValue(e.option.value);
  }

}
