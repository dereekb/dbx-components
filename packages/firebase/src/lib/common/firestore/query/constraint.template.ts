import { type DateRange, dateRange, type DateRangeInput } from '@dereekb/date';
import { type StringKeyPropertyKeys, UTF_8_START_CHARACTER, UTF_PRIVATE_USAGE_AREA_START } from '@dereekb/util';
import { type RootFirestoreModelIdentity } from '../collection/collection';
import { type DocumentReference, type FieldPathOrStringPath, type FieldPathOrStringPathOf } from '../types';
import { endAtValue, type FirestoreQueryConstraint, orderByDocumentId, startAtValue, orderBy, type OrderByDirection, where } from './constraint';

// MARK: Parents
/**
 * Creates constraints to query all child documents under a specific parent document reference.
 *
 * This function is designed to be used with a CollectionGroup query to filter results to only
 * include documents that are descendants of the specified parent. It's useful for hierarchical data
 * structures where you need to retrieve all documents of a certain type that belong to a specific parent.
 *
 * @template P - The parent document data type
 * @param parentRef - The parent document reference
 * @returns Array of query constraints to filter by parent document
 *
 * @example
 * // Get all 'comments' documents under a specific 'post'
 * const postRef = doc(firestore, 'posts', postId);
 * const query = collectionGroup(firestore, 'comments')
 *   .where(...allChildDocumentsUnderParent(postRef));
 */
export function allChildDocumentsUnderParent<P>(parentRef: DocumentReference<P>): FirestoreQueryConstraint[] {
  return allChildDocumentsUnderParentPath(parentRef.path);
}

/**
 * Creates constraints to query all child documents under a specific parent path.
 *
 * Similar to allChildDocumentsUnderParent but takes a string path instead of a document reference.
 * This is useful when you have the path to a parent document but don't need to create a reference.
 * Uses a range query on document IDs to efficiently filter for descendants.
 *
 * @param parentPath - The full path to the parent document (e.g., 'users/123')
 * @returns Array of query constraints to filter by parent path
 *
 * @example
 * // Get all 'comments' under a specific post without creating a reference
 * const query = collectionGroup(firestore, 'comments')
 *   .where(...allChildDocumentsUnderParentPath('posts/abc123'));
 */
export function allChildDocumentsUnderParentPath(parentPath: string): FirestoreQueryConstraint[] {
  // https://medium.com/firebase-developers/how-to-query-collections-in-firestore-under-a-certain-path-6a0d686cebd2
  // https://medium.com/firelayer/save-money-on-the-list-query-in-firestore-26ef9bee5474 for restricting
  return [orderByDocumentId(), startAtValue(parentPath), endAtValue(parentPath + UTF_8_START_CHARACTER)];
}

/**
 * Creates constraints to query documents that have a field value starting with a specific prefix.
 *
 * Unlike allChildDocumentsUnderParent, this function filters on a field value rather than
 * the document path. This is useful when you're storing hierarchical references in a field
 * rather than relying on the document path itself.
 *
 * For example, if documents have a 'parentPath' field that contains a string path, you can
 * filter to find all documents where that field starts with a specific value.
 *
 * @template T - The document data type
 * @param orderByFieldPath - The field path to filter on
 * @param parentValue - The string value prefix to match
 * @param sortDirection - Optional direction to sort results (default: 'asc')
 * @returns Array of query constraints to filter by field value prefix
 *
 * @example
 * // Find all documents where the 'parentPath' field starts with 'organizations/org123/'
 * const query = collectionGroup(firestore, 'tasks')
 *   .where(...allChildDocumentsUnderRelativePath('parentPath', 'organizations/org123/'));
 */
export function allChildDocumentsUnderRelativePath<T>(orderByFieldPath: StringKeyPropertyKeys<T>, parentValue: string, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function allChildDocumentsUnderRelativePath(orderByFieldPath: FieldPathOrStringPath, parentValue: string, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function allChildDocumentsUnderRelativePath<T = object>(orderByFieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, parentValue: string, sortDirection?: OrderByDirection): FirestoreQueryConstraint[] {
  return [orderBy(orderByFieldPath as FieldPathOrStringPath, sortDirection), startAtValue(parentValue), endAtValue(parentValue + UTF_PRIVATE_USAGE_AREA_START)];
}

/**
 * Creates constraints to find documents where a field contains a reference to a specific model type.
 *
 * This utility searches for string values that start with a specific model collection type prefix.
 * It's useful when you're storing references to other models as strings in the format
 * 'collectionType/id'.
 *
 * @template T - The document data type
 * @param orderByFieldPath - The field containing model references
 * @param value - The root model identity containing the collection type to search for
 * @param sortDirection - Optional direction to sort results (default: 'asc')
 * @returns Array of query constraints to filter by model type
 *
 * @example
 * // Find all documents where the 'reference' field contains a reference to a 'users' model
 * const query = collection(firestore, 'documents')
 *   .where(...whereStringHasRootIdentityModelKey('reference', { collectionType: 'users' }));
 */
export function whereStringHasRootIdentityModelKey<T = object>(orderByFieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, value: RootFirestoreModelIdentity, sortDirection?: OrderByDirection): FirestoreQueryConstraint[] {
  return whereStringValueHasPrefix(orderByFieldPath as FieldPathOrStringPath, `${value.collectionType}/`, sortDirection);
}

/**
 * Creates constraints to find documents where a string field starts with a specific prefix.
 *
 * This utility creates a range query that efficiently finds all documents where a string
 * field starts with the specified prefix. This is more efficient than using a LIKE query
 * since it can utilize Firestore's indexes.
 *
 * @template T - The document data type
 * @param orderByFieldPath - The string field to search
 * @param parentValue - The prefix to match at the start of the field
 * @param sortDirection - Optional direction to sort results (default: 'asc')
 * @returns Array of query constraints to filter by string prefix
 *
 * @example
 * // Find all documents where the 'email' field starts with 'admin@'
 * const query = collection(firestore, 'users')
 *   .where(...whereStringValueHasPrefix('email', 'admin@'));
 */
export function whereStringValueHasPrefix<T>(orderByFieldPath: StringKeyPropertyKeys<T>, parentValue: string, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereStringValueHasPrefix(orderByFieldPath: FieldPathOrStringPath, parentValue: string, sortDirection?: OrderByDirection): FirestoreQueryConstraint[];
export function whereStringValueHasPrefix<T = object>(orderByFieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, value: string, sortDirection?: OrderByDirection): FirestoreQueryConstraint[] {
  return [orderBy(orderByFieldPath as FieldPathOrStringPath, sortDirection), startAtValue(value), endAtValue(value + UTF_PRIVATE_USAGE_AREA_START)];
}

// MARK: Dates
/**
 * Creates constraints to filter documents by a date field within a specific date range.
 *
 * This function creates constraints to find documents where a date field falls within
 * a specified range. It automatically orders the results by the date field and applies
 * appropriate filters for the start and end dates.
 *
 * @template T - The document data type
 * @param field - The date field to filter on (stored as ISO string in Firestore)
 * @param dateRange - The date range to filter by (start and/or end date)
 * @param sortDirection - Optional direction to sort results (default: 'asc')
 * @returns Array of query constraints to filter by date range
 *
 * @example
 * // Find documents created in the last 7 days
 * const lastWeek = { startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
 * const query = collection(firestore, 'documents')
 *   .where(...filterWithDateRange('createdAt', lastWeek));
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
 * Creates constraints to filter documents by a date field within a range specified by flexible input.
 *
 * This function accepts various forms of date range inputs (start/end dates, relative ranges,
 * predefined periods) and converts them to appropriate query constraints. It's more flexible
 * than filterWithDateRange because it accepts different input formats.
 *
 * @template T - The document data type
 * @param field - The date field to filter on (stored as ISO string in Firestore)
 * @param rangeInput - Flexible specification of a date range
 * @param sortDirection - Optional direction to sort results (default: 'asc')
 * @returns Array of query constraints to filter by date range
 *
 * @example
 * // Find documents from January 2023
 * const query = collection(firestore, 'documents')
 *   .where(...whereDateIsInRange('createdAt', { month: 0, year: 2023 }));
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
 * Creates a constraint to filter documents where a date field is greater than or equal to a specified date.
 *
 * This function creates a simple comparison constraint that finds documents where a date field
 * is on or after a specific date. If no date is provided, it defaults to the current date and time.
 *
 * @template T - The document data type
 * @param field - The date field to filter on (stored as ISO string in Firestore)
 * @param date - The minimum date to include (default: current date/time)
 * @returns A query constraint to filter for dates on or after the specified date
 *
 * @example
 * // Find documents created today or in the future
 * const query = collection(firestore, 'documents')
 *   .where(whereDateIsOnOrAfter('createdAt'));
 *
 * // Find documents created on or after a specific date
 * const startOfYear = new Date(2023, 0, 1);
 * const query = collection(firestore, 'documents')
 *   .where(whereDateIsOnOrAfter('createdAt', startOfYear));
 */
export function whereDateIsOnOrAfter<T>(field: StringKeyPropertyKeys<T>, date?: Date): FirestoreQueryConstraint;
export function whereDateIsOnOrAfter(field: FieldPathOrStringPath, date?: Date): FirestoreQueryConstraint;
export function whereDateIsOnOrAfter<T = object>(fieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, date: Date = new Date()): FirestoreQueryConstraint {
  return where(fieldPath as FieldPathOrStringPath, '>=', date.toISOString());
}

/**
 * Creates constraints to filter documents by dates on or after a specified date, with sorting.
 *
 * This function combines a date comparison constraint with a sort order, returning an array of
 * constraints that can be applied to a query. It finds documents where a date field is on or
 * after a specific date, and sorts the results by that same date field.
 *
 * @template T - The document data type
 * @param field - The date field to filter and sort on (stored as ISO string in Firestore)
 * @param date - The minimum date to include (default: current date/time)
 * @param sortDirection - Direction to sort results (default: 'asc')
 * @returns Array of query constraints for filtering and sorting
 *
 * @example
 * // Find documents created today or in the future, sorted newest first
 * const query = collection(firestore, 'documents')
 *   .where(...whereDateIsOnOrAfterWithSort('createdAt', new Date(), 'desc'));
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
