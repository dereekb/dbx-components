import { SubscriptionObject } from '@dereekb/rxjs';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { AbstractDbxSearchableValueFieldDirective, SearchableValueFieldsFieldProps } from './searchable.field.directive';
import { map, shareReplay, skipWhile, distinctUntilChanged } from 'rxjs';
import { tapDetectChanges } from '@dereekb/dbx-core';
import { PrimativeKey } from '@dereekb/util';

export interface SearchableTextValueFieldsFieldProps<T, M = unknown, H extends PrimativeKey = PrimativeKey> extends SearchableValueFieldsFieldProps<T, M, H> {
  showSelectedValue?: boolean;
}

/**
 * Display component for selecting a single item/value.
 */
@Component({
  templateUrl: 'searchable.text.field.component.html'
})
export class DbxSearchableTextFieldComponent<T, M = unknown, H extends PrimativeKey = PrimativeKey> extends AbstractDbxSearchableValueFieldDirective<T, M, H, SearchableTextValueFieldsFieldProps<T, M, H>> implements OnInit, OnDestroy {
  override allowSyncValueToInput = true;

  readonly selectedDisplayValue$ = this.displayValues$.pipe(
    map((x) => x[0]),
    shareReplay(1),
    tapDetectChanges(this.cdRef)
  );

  readonly hasValue$ = this.selectedDisplayValue$.pipe(map((x) => Boolean(x)));
  readonly showSelectedDisplayValue$ = this.selectedDisplayValue$.pipe(
    map((x) => this.showSelectedValue && Boolean(x)),
    distinctUntilChanged(),
    shareReplay(1),
    tapDetectChanges(this.cdRef)
  );

  override get searchableField(): SearchableTextValueFieldsFieldProps<T, M, H> {
    return this.props;
  }

  get showSelectedValue() {
    return this.searchableField.showSelectedValue ?? !this.allowStringValues; // Show the selected value only if string values are allowed.
  }

  get multiSelect() {
    return false;
  }

  private _clearInputSub = new SubscriptionObject();

  override ngOnInit(): void {
    super.ngOnInit();

    this._clearInputSub.subscription = this.inputValue$.pipe(skipWhile((x) => !x)).subscribe((x) => {
      if (!x) {
        // this.clearValues();
      }
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._clearInputSub.destroy();
  }

  selected(event: MatAutocompleteSelectedEvent): void {
    this.addWithDisplayValue(event.option.value);
  }
}
