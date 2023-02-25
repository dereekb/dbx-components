import { DateRange, dateRange, DateRangeInput } from '@dereekb/date';
import { StringKeyPropertyKeys, UTF_8_START_CHARACTER, UTF_PRIVATE_USAGE_AREA_START } from '@dereekb/util';
import { DocumentReference, FieldPathOrStringPath, FieldPathOrStringPathOf } from '../types';
import { endAtValue, FirestoreQueryConstraint, orderByDocumentId, startAtValue, orderBy, OrderByDirection, where } from './constraint';

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
 * Sorts in ascending order by default.
 *
 * @param field
 * @param date
 * @param sortDirection
 */
export function whereDateIsOnOrAfter<T>(field: StringKeyPropertyKeys<T>, date?: Date, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereDateIsOnOrAfter(field: FieldPathOrStringPath, date?: Date, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereDateIsOnOrAfter<T = object>(fieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, date: Date = new Date(), sortDirection?: OrderByDirection): FirestoreQueryConstraint[] {
  return [orderBy(fieldPath as FieldPathOrStringPath, sortDirection ?? 'asc'), where(fieldPath as FieldPathOrStringPath, '>=', date.toISOString())];
}

/**
 * Searches dates that are before the input date. If no date is input, uses now.
 *
 * @param field
 * @param date
 * @param sortDirection
 */
export function whereDateIsBefore<T>(field: StringKeyPropertyKeys<T>, date?: Date, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereDateIsBefore(field: FieldPathOrStringPath, date?: Date, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereDateIsBefore<T = object>(fieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, date: Date = new Date(), sortDirection?: OrderByDirection): FirestoreQueryConstraint[] {
  return [orderBy(fieldPath as FieldPathOrStringPath, sortDirection ?? 'desc'), where(fieldPath as FieldPathOrStringPath, '<', date.toISOString())];
}
