import { ClickableAnchor } from '@dereekb/dbx-core';
import { Type } from '@angular/core';
import { Observable } from 'rxjs';
import { SelectionDisplayValue, SelectionValue, SelectionValueHashFn } from '../selection';

export interface SearchableFieldDisplayComponent<T> {
  displayValue?: SearchableValueFieldDisplayValue<T>;
}

export interface SearchableValueFieldValue<T, M = any> extends SelectionValue<T, M> {

  /**
   * Optional anchor metadata on the field.
   */
  anchor?: ClickableAnchor;
}

/**
 * Displayed value.
 */
export interface SearchableValueFieldDisplayValue<T, M = any> extends SelectionDisplayValue<T, M>, SearchableValueFieldValue<T, M> {
  sublabel?: string;
  /**
   * Custom component class to use.
   */
  componentClass?: Type<SearchableFieldDisplayComponent<T>>;
}

/**
 * SearchableValueField function for searching values.
 */
export type SearchableValueFieldStringSearchFn<T> = (search: string) => Observable<SearchableValueFieldValue<T>[]>;

/**
 * SearchableValueField function that allows the values a chance to go through another observable for any changes.
 *
 * An example usage is passing an email address, then getting back metadata that can be used to show the values.
 *
 * The value itself should not change. All other fields on the value may change, however.
 */
export type SearchableValueFieldDisplayFn<T> = (values: SearchableValueFieldValue<T>[]) => Observable<SearchableValueFieldDisplayValue<T>[]>;

/**
 * SearchableValueField function for setting anchor values on a field value.
 */
export type SearchableValueFieldAnchorFn<T> = (value: SearchableValueFieldValue<T>) => ClickableAnchor;

export type SearchableValueFieldHashFn<T> = SelectionValueHashFn<T>;
