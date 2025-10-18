import { type MapFunction, type PrimativeKey } from '@dereekb/util';
import { type DbxInjectionComponentConfig, type ClickableAnchor } from '@dereekb/dbx-core';
import { type Observable } from 'rxjs';
import { type SelectionDisplayValue, type SelectionValue, type SelectionValueHashFunction } from '../selection';

export interface SearchableValueFieldValue<T, M = unknown> extends SelectionValue<T, M> {
  /**
   * Optional anchor metadata on the field.
   */
  readonly anchor?: ClickableAnchor;
}

/**
 * Displayed value.
 */
export interface SearchableValueFieldDisplayValue<T, M = unknown> extends SelectionDisplayValue<T, M>, SearchableValueFieldValue<T, M> {
  /**
   * Display override configuration
   */
  readonly display?: Partial<DbxInjectionComponentConfig>;
}

export interface ConfiguredSearchableValueFieldDisplayValue<T, M = unknown> extends Omit<SearchableValueFieldDisplayValue<T, M>, 'display'> {
  readonly display: DbxInjectionComponentConfig;
}

/**
 * SearchableValueField function for searching values.
 */
export type SearchableValueFieldStringSearchFn<T, M = unknown> = MapFunction<string, Observable<SearchableValueFieldValue<T, M>[]>>;

/**
 * SearchableValueField function that allows the values a chance to go through another observable for unknown changes.
 *
 * An example usage is passing an email address, then getting back metadata that can be used to show the values.
 *
 * The value itself should not change. All other fields on the value may change, however.
 */
export type SearchableValueFieldDisplayFn<T, M = unknown> = MapFunction<SearchableValueFieldValue<T, M>[], Observable<SearchableValueFieldDisplayValue<T, M>[]>>;

/**
 * SearchableValueField function for setting anchor values on a field value.
 */
export type SearchableValueFieldAnchorFn<T, M = unknown> = MapFunction<SearchableValueFieldValue<T, M>, ClickableAnchor>;

export type SearchableValueFieldHashFn<T, H extends PrimativeKey = PrimativeKey> = SelectionValueHashFunction<T, H>;
