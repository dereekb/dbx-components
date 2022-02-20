import { SubscriptionObject } from '@dereekb/rxjs';
import { Component } from '@angular/core';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { AbstractDbxSearchableValueFieldDirective, SearchableValueFieldsFieldConfig, SearchableValueFieldsFormlyFieldConfig } from './searchable.field.directive';
import { map, shareReplay, skipWhile, distinctUntilChanged } from 'rxjs';
import { tapDetectChanges } from '@dereekb/dbx-core';

export interface SearchableTextValueFieldsFieldConfig<T> extends SearchableValueFieldsFieldConfig<T> {
  showSelectedValue?: boolean;
}

export interface SearchableTextValueFieldsFormlyFieldConfig<T> extends SearchableValueFieldsFormlyFieldConfig<T> {
  searchableField: SearchableTextValueFieldsFieldConfig<T>;
}

/**
 * Display component for selecting a single item/value.
 */
@Component({
  templateUrl: 'searchable.text.field.component.html'
})
export class DbxSearchableTextFieldComponent<T> extends AbstractDbxSearchableValueFieldDirective<T, SearchableTextValueFieldsFormlyFieldConfig<T>> {

  readonly selectedDisplayValue$ = this.displayValues$.pipe(map(x => x[0]), shareReplay(1), tapDetectChanges(this.cdRef));
  readonly hasValue$ = this.selectedDisplayValue$.pipe(map(x => Boolean(x)));
  readonly showSelectedDisplayValue$ = this.selectedDisplayValue$.pipe(map(x => this.showSelectedValue && Boolean(x)), distinctUntilChanged(), shareReplay(1), tapDetectChanges(this.cdRef));

  override get searchableField(): SearchableTextValueFieldsFieldConfig<T> {
    return this.field.searchableField;
  }

  get showSelectedValue() {
    return this.searchableField.showSelectedValue ?? !this.allowStringValues;    // Show the selected value only if string values are allowed.
  }

  override readonly multiSelect = false;

  private _clearInputSub = new SubscriptionObject();

  override ngOnInit(): void {
    super.ngOnInit();

    this._clearInputSub.subscription = this.inputValue$.pipe(
      skipWhile((x) => !x)
    ).subscribe((x) => {
      if (!x) {
        // this.clearValues();
      }
    })
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._clearInputSub.destroy();
  }

  selected(event: any): void {
    const e: MatAutocompleteSelectedEvent = event;
    this.addWithDisplayValue(e.option.value);
  }

}
