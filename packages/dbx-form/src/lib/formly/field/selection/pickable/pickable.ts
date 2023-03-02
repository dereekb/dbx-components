import { Maybe, PrimativeKey } from '@dereekb/util';
import { Observable } from 'rxjs';
import { SelectionDisplayValue, SelectionValue, SelectionValueHashFunction } from '../selection';

export type PickableValueFieldValue<T, M = unknown> = SelectionValue<T, M>;
export type PickableValueFieldDisplayValue<T, M = unknown> = SelectionDisplayValue<T, M>;

/**
 * PickableValueField function for retrieving all values.
 */
export type PickableValueFieldLoadValuesFunction<T, M = unknown> = () => Observable<PickableValueFieldValue<T, M>[]>;

/**
 * PickableValueField function that allows the values a chance to go through another observable for any changes.
 *
 * Values may not have metadata on them in some cases, where the value may infact be an unknown value.
 * The returned value should be marked as unknown, or if it has no meta but is known, isUnknown should be marked false.
 *
 * The value itself should not change. All other fields on the value may change, however.
 */
export type PickableValueFieldDisplayFunction<T, M = unknown> = (values: PickableValueFieldValue<T, M>[]) => Observable<PickableValueFieldDisplayValue<T, M>[]>;

/**
 * Used for filtering the values that should be displayed.
 */
export type PickableValueFieldFilterFunction<T, M = unknown> = (flterText: Maybe<string>, values: PickableValueFieldDisplayValue<T, M>[]) => Observable<T[]>;

/**
 * Used to hash the value from the input pickable value.
 */
export type PickableValueFieldHashFunction<T, H extends PrimativeKey = PrimativeKey> = SelectionValueHashFunction<T, H>;

// MARK: Compat
/**
 * @deprecated Replace with PickableValueFieldLoadValuesFunction
 */
export type PickableValueFieldLoadValuesFn<T, M = unknown> = PickableValueFieldLoadValuesFunction<T, M>;

/**
 * @deprecated Replace with PickableValueFieldDisplayFunction
 */
export type PickableValueFieldDisplayFn<T, M = unknown> = PickableValueFieldDisplayFunction<T, M>;

/**
 * @deprecated Replace with PickableValueFieldFilterFunction
 */
export type PickableValueFieldFilterFn<T, M = unknown> = PickableValueFieldFilterFunction<T, M>;

/**
 * @deprecated Replace with  PickableValueFieldHashFunction
 */
export type PickableValueFieldHashFn<T, H extends PrimativeKey = PrimativeKey> = PickableValueFieldHashFunction<T, H>;
