import { Component } from '@angular/core';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipInputEvent } from '@angular/material/chips';
import { AbstractDbxSearchableValueFieldDirective, SearchableValueFieldsFieldConfig, SearchableValueFieldsFormlyFieldConfig } from './searchable.field.directive';
import { COMMA, ENTER } from '@angular/cdk/keycodes';

export interface SearchableChipValueFieldsFieldConfig<T> extends SearchableValueFieldsFieldConfig<T> { }
export interface SearchableChipValueFieldsFormlyFieldConfig<T> extends SearchableChipValueFieldsFieldConfig<T>, SearchableValueFieldsFormlyFieldConfig<T> { }

@Component({
  templateUrl: 'searchable.chip.field.component.html'
})
export class DbxSearchableChipFieldComponent<T> extends AbstractDbxSearchableValueFieldDirective<T, SearchableChipValueFieldsFormlyFieldConfig<T>> {

  readonly separatorKeysCodes: number[] = [ENTER, COMMA];

  selected(event: MatAutocompleteSelectedEvent): void {
    this.addWithDisplayValue(event.option.value);
  }

  tabPressedOnInput(event: KeyboardEvent): boolean {
    if (event?.key?.toLowerCase() === 'tab') {
      const value = this.inputCtrl.value;

      if ((value || '').trim()) {
        this._addWithTextValue(value);
        event.preventDefault();
        event.stopImmediatePropagation();
        return false;
      }
    }

    return true;
  }

  addChip(event: MatChipInputEvent): void {
    const text = event.value ?? this.inputCtrl.value;
    return this._addWithTextValue(text);
  }

}
