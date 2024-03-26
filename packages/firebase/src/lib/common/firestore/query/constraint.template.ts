import { type DateRange, dateRange, type DateRangeInput } from '@dereekb/date';
import { type StringKeyPropertyKeys, UTF_8_START_CHARACTER, UTF_PRIVATE_USAGE_AREA_START } from '@dereekb/util';
import { type RootFirestoreModelIdentity } from '../collection/collection';
import { type DocumentReference, type FieldPathOrStringPath, type FieldPathOrStringPathOf } from '../types';
import { endAtValue, type FirestoreQueryConstraint, orderByDocumentId, startAtValue, orderBy, type OrderByDirection, where } from './constraint';

// MARK: Parents
/**
 * Use with a CollectionGroup query to return all child documents that are under a given parent.
 *
 * @param parentRef U
 * @returns
 */
export function allChildDocumentsUnderParent<P>(parentRef: DocumentReference<P>): FirestoreQueryConstraint[] {
  return allChildDocumentsUnderParentPath(parentRef.path);
}

/**
 * Use with a CollectionGroup query to return all child documents that have a given path.
 *
 * @param parentPath
 * @returns
 */
export function allChildDocumentsUnderParentPath(parentPath: string): FirestoreQueryConstraint[] {
  // https://medium.com/firebase-developers/how-to-query-collections-in-firestore-under-a-certain-path-6a0d686cebd2
  // https://medium.com/firelayer/save-money-on-the-list-query-in-firestore-26ef9bee5474 for restricting
  return [orderByDocumentId(), startAtValue(parentPath), endAtValue(parentPath + UTF_8_START_CHARACTER)];
}

/**
 * Use with a CollectionGroup query to return all child documents that are under a given path based on values in a field.
 *
 * For example, if each value has a field that references another object with a parent, you can filter on that parent's value range, or parents of that value in order to return
 * all jobs for that range.
 *
 * Example:
 * - objects with path "rc/aaa/rcs/bbb" and "rc/aaa/rcs/ccc" will be returned when querying for "rc/aaa".
 *
 * @param parentValue
 * @returns
 */
export function allChildDocumentsUnderRelativePath<T>(orderByFieldPath: StringKeyPropertyKeys<T>, parentValue: string, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function allChildDocumentsUnderRelativePath(orderByFieldPath: FieldPathOrStringPath, parentValue: string, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function allChildDocumentsUnderRelativePath<T = object>(orderByFieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, parentValue: string, sortDirection?: OrderByDirection): FirestoreQueryConstraint[] {
  return [orderBy(orderByFieldPath as FieldPathOrStringPath, sortDirection), startAtValue(parentValue), endAtValue(parentValue + UTF_PRIVATE_USAGE_AREA_START)];
}

/**
 * Searches a specified field for string values that start with a model key's collection type.
 *
 * @param orderByFieldPath
 * @param parentValue
 * @param sortDirection
 */
export function whereStringHasRootIdentityModelKey<T = object>(orderByFieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, value: RootFirestoreModelIdentity, sortDirection?: OrderByDirection): FirestoreQueryConstraint[] {
  return whereStringValueHasPrefix(orderByFieldPath as FieldPathOrStringPath, `${value.collectionType}/`, sortDirection);
}

/**
 * Searches a specified field for string values that have a specific prefix.
 *
 * @param orderByFieldPath
 * @param parentValue
 * @param sortDirection
 */
export function whereStringValueHasPrefix<T>(orderByFieldPath: StringKeyPropertyKeys<T>, parentValue: string, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereStringValueHasPrefix(orderByFieldPath: FieldPathOrStringPath, parentValue: string, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereStringValueHasPrefix<T = object>(orderByFieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, value: string, sortDirection?: OrderByDirection): FirestoreQueryConstraint[] {
  return [orderBy(orderByFieldPath as FieldPathOrStringPath, sortDirection), startAtValue(value), endAtValue(value + UTF_PRIVATE_USAGE_AREA_START)];
}

// MARK: Dates
/**
 * Searches dates that follow between the dates derived from the input. Excludes the end date.
 *
 * Sorts in ascending order by default.
 *
 * @param field
 * @param range
 * @param sortDirection
 */
export function filterWithDateRange<T>(field: StringKeyPropertyKeys<T>, dateRange: Partial<DateRange>, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function filterWithDateRange(field: FieldPathOrStringPath, dateRange: Partial<DateRange>, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function filterWithDateRange<T = object>(fieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, dateRange: Partial<DateRange>, sortDirection?: OrderByDirection): FirestoreQueryConstraint[] {
  const { start, end } = dateRange;

  if (start && end) {
    return whereDateIsBetween(fieldPath as FieldPathOrStringPath, { start, end }, sortDirection);
  } else if (start) {
    return whereDateIsOnOrAfterWithSort(fieldPath as FieldPathOrStringPath, start, sortDirection);
  } else if (end) {
    return whereDateIsOnOrBeforeWithSort(fieldPath as FieldPathOrStringPath, end, sortDirection);
  } else {
    return [];
  }
}

/**
 * Searches dates that follow between the dates derived from the input. Excludes the end date.
 *
 * Sorts in ascending order by default.
 *
 * @param field
 * @param range
 * @param sortDirection
 */
export function whereDateIsInRange<T>(field: StringKeyPropertyKeys<T>, rangeInput: DateRangeInput, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereDateIsInRange(field: FieldPathOrStringPath, rangeInput: DateRangeInput, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereDateIsInRange<T = object>(fieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, rangeInput: DateRangeInput, sortDirection?: OrderByDirection): FirestoreQueryConstraint[] {
  const range = dateRange(rangeInput);
  return whereDateIsBetween(fieldPath as FieldPathOrStringPath, range, sortDirection);
}

/**
 * Searches dates that follow between the input DateRange. Excludes the end date.
 *
 * Sorts in ascending order by default.
 *
 * @param field
 * @param range
 * @param sortDirection
 */
export function whereDateIsBetween<T>(field: StringKeyPropertyKeys<T>, range: DateRange, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereDateIsBetween(field: FieldPathOrStringPath, range: DateRange, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereDateIsBetween<T = object>(fieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, range: DateRange, sortDirection?: OrderByDirection): FirestoreQueryConstraint[] {
  const { start, end } = range;
  return [orderBy(fieldPath as FieldPathOrStringPath, sortDirection ?? 'asc'), where(fieldPath as FieldPathOrStringPath, '>=', start.toISOString()), where(fieldPath as FieldPathOrStringPath, '<', end.toISOString())];
}

/**
 * Searches dates that are on or after the input date. If no date is input, uses now.
 *
 * @param field
 * @param date
 * @param sortDirection
 */
export function whereDateIsOnOrAfter<T>(field: StringKeyPropertyKeys<T>, date?: Date): FirestoreQueryConstraint;
export function whereDateIsOnOrAfter(field: FieldPathOrStringPath, date?: Date): FirestoreQueryConstraint;
export function whereDateIsOnOrAfter<T = object>(fieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, date: Date = new Date()): FirestoreQueryConstraint {
  return where(fieldPath as FieldPathOrStringPath, '>=', date.toISOString());
}

/**
 * Searches dates that are on or after the input date. If no date is input, uses now.
 *
 * Sorts in ascending order by default.
 *
 * @param field
 * @param date
 * @param sortDirection
 */
export function whereDateIsOnOrAfterWithSort<T>(field: StringKeyPropertyKeys<T>, date?: Date, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereDateIsOnOrAfterWithSort(field: FieldPathOrStringPath, date?: Date, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereDateIsOnOrAfterWithSort<T = object>(fieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, date: Date = new Date(), sortDirection?: OrderByDirection): FirestoreQueryConstraint[] {
  return [orderBy(fieldPath as FieldPathOrStringPath, sortDirection ?? 'asc'), whereDateIsOnOrAfter(fieldPath as FieldPathOrStringPath, date)];
}

/**
 * Searches dates that are on or before the input date. If no date is input, uses now.
 *
 * @param field
 * @param date
 * @param sortDirection
 */
export function whereDateIsOnOrBefore<T>(field: StringKeyPropertyKeys<T>, date?: Date): FirestoreQueryConstraint;
export function whereDateIsOnOrBefore(field: FieldPathOrStringPath, date?: Date): FirestoreQueryConstraint;
export function whereDateIsOnOrBefore<T = object>(fieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, date: Date = new Date()): FirestoreQueryConstraint {
  return where(fieldPath as FieldPathOrStringPath, '<=', date.toISOString());
}

/**
 * Searches dates that are on or before the input date. If no date is input, uses now.
 *
 * Sorts in descending order by default.
 *
 * @param field
 * @param date
 * @param sortDirection
 */
export function whereDateIsOnOrBeforeWithSort<T>(field: StringKeyPropertyKeys<T>, date?: Date, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereDateIsOnOrBeforeWithSort(field: FieldPathOrStringPath, date?: Date, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereDateIsOnOrBeforeWithSort<T = object>(fieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, date: Date = new Date(), sortDirection?: OrderByDirection): FirestoreQueryConstraint[] {
  return [orderBy(fieldPath as FieldPathOrStringPath, sortDirection ?? 'desc'), whereDateIsOnOrBefore(fieldPath as FieldPathOrStringPath, date)];
}

/**
 * Searches dates that are on or after the input date. If no date is input, uses now.
 *
 * @param field
 * @param date
 * @param sortDirection
 */
export function whereDateIsAfter<T>(field: StringKeyPropertyKeys<T>, date?: Date): FirestoreQueryConstraint;
export function whereDateIsAfter(field: FieldPathOrStringPath, date?: Date): FirestoreQueryConstraint;
export function whereDateIsAfter<T = object>(fieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, date: Date = new Date()): FirestoreQueryConstraint {
  return where(fieldPath as FieldPathOrStringPath, '>', date.toISOString());
}

/**
 * Searches dates that are on or after the input date. If no date is input, uses now.
 *
 * Sorts in ascending order by default.
 *
 * @param field
 * @param date
 * @param sortDirection
 */
export function whereDateIsAfterWithSort<T>(field: StringKeyPropertyKeys<T>, date?: Date, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereDateIsAfterWithSort(field: FieldPathOrStringPath, date?: Date, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereDateIsAfterWithSort<T = object>(fieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, date: Date = new Date(), sortDirection?: OrderByDirection): FirestoreQueryConstraint[] {
  return [orderBy(fieldPath as FieldPathOrStringPath, sortDirection ?? 'asc'), whereDateIsAfter(fieldPath as FieldPathOrStringPath, date)];
}

/**
 * Searches dates that are on or after the input date. If no date is input, uses now.
 *
 * @param field
 * @param date
 * @param sortDirection
 */
export function whereDateIsBefore<T>(field: StringKeyPropertyKeys<T>, date?: Date): FirestoreQueryConstraint;
export function whereDateIsBefore(field: FieldPathOrStringPath, date?: Date): FirestoreQueryConstraint;
export function whereDateIsBefore<T = object>(fieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, date: Date = new Date()): FirestoreQueryConstraint {
  return where(fieldPath as FieldPathOrStringPath, '<', date.toISOString());
}

/**
 * Searches dates that are on or after the input date. If no date is input, uses now.
 *
 * Sorts in descending order by default.
 *
 * @param field
 * @param date
 * @param sortDirection
 */
export function whereDateIsBeforeWithSort<T>(field: StringKeyPropertyKeys<T>, date?: Date, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereDateIsBeforeWithSort(field: FieldPathOrStringPath, date?: Date, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereDateIsBeforeWithSort<T = object>(fieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, date: Date = new Date(), sortDirection?: OrderByDirection): FirestoreQueryConstraint[] {
  return [orderBy(fieldPath as FieldPathOrStringPath, sortDirection ?? 'desc'), whereDateIsBefore(fieldPath as FieldPathOrStringPath, date)];
}
