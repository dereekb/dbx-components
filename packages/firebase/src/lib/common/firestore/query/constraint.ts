import { type FieldPathOrStringPath, type FieldPathOrStringPathOf } from './../types';
import { type ArrayOrValue, asArray, pushItemOrArrayItemsIntoArray, type SeparateResult, separateValues, type SortingOrder, type Maybe, type StringKeyPropertyKeys, convertToArray } from '@dereekb/util';
import { type DocumentSnapshot, type DocumentData, type FieldPath } from '../types';

/**
 * Type identifier for a Firestore query constraint.
 */
export type FirestoreQueryConstraintType = string;

/**
 * A constraint. Used by drivers to apply native firebase query constraints.
 */
export interface FirestoreQueryConstraint<T = unknown> {
  readonly type: FirestoreQueryConstraintType;
  readonly data: T;
}

/**
 * Creates a Firestore query constraint.
 *
 * @template T - Type of data stored in the constraint
 * @param type - The constraint type identifier
 * @param data - The constraint data
 * @returns A Firestore query constraint object
 */
export function firestoreQueryConstraint<T = unknown>(type: string, data: T): FirestoreQueryConstraint<T> {
  return {
    type,
    data
  };
}

/**
 * Creates a factory function for producing constraints of a specific type.
 *
 * @param type - The constraint type identifier
 * @returns A function that creates constraints of the specified type
 */
export function firestoreQueryConstraintFactory(type: string): <T = unknown>(data: T) => FirestoreQueryConstraint<T> {
  return <T>(data: T) => firestoreQueryConstraint(type, data);
}

// MARK: Limit
/**
 * Constraint type identifier for limiting the number of documents returned.
 */
export const FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE = 'limit';

/**
 * Configuration data for a limit constraint.
 */
export interface LimitQueryConstraintData {
  /**
   * Maximum number of documents to return
   */
  readonly limit: number;
}

/**
 * Creates a constraint that limits the maximum number of documents to return.
 *
 * @param limit - Maximum number of documents to return
 * @returns A Firestore query constraint for limiting results
 */
export function limit(limit: number): FirestoreQueryConstraint<LimitQueryConstraintData> {
  return firestoreQueryConstraint(FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE, { limit });
}

// MARK: Limit To Last
/**
 * Constraint type identifier for limiting to the last N documents in query order.
 */
export const FIRESTORE_LIMIT_TO_LAST_QUERY_CONSTRAINT_TYPE = 'limit_to_last';

/**
 * Configuration data for a limitToLast constraint.
 */
export interface LimitToLastQueryConstraintData {
  /**
   * Maximum number of documents to return from the end of the results
   */
  readonly limit: number;
}

/**
 * Creates a constraint that returns the last matching documents in the query, up to the limit.
 *
 * Does not work with queries with streamed results.
 *
 * @param limit - Maximum number of documents to return from the end of the results
 * @returns A Firestore query constraint for limiting results to the last N documents
 */
export function limitToLast(limit: number): FirestoreQueryConstraint<LimitToLastQueryConstraintData> {
  return firestoreQueryConstraint(FIRESTORE_LIMIT_TO_LAST_QUERY_CONSTRAINT_TYPE, { limit });
}

// MARK: Offset
/**
 * Constraint type identifier for skipping a number of documents.
 */
export const FIRESTORE_OFFSET_QUERY_CONSTRAINT_TYPE = 'offset';

/**
 * Configuration data for an offset constraint.
 */
export interface OffsetQueryConstraintData {
  /**
   * Number of documents to skip before returning results
   */
  offset: number;
}

/**
 * Creates a constraint that skips the first N documents in the query results.
 *
 * @param offset - Number of documents to skip
 * @returns A Firestore query constraint for offsetting results
 */
export function offset(offset: number): FirestoreQueryConstraint<OffsetQueryConstraintData> {
  return firestoreQueryConstraint(FIRESTORE_OFFSET_QUERY_CONSTRAINT_TYPE, { offset });
}

// MARK: Where
/**
 * Constraint type identifier for filtering documents by field values.
 */
export const FIRESTORE_WHERE_QUERY_CONSTRAINT_TYPE = 'where';

/**
 * All Firestore value comparison operators.
 */
export type WhereFilterOpValue = '<' | '<=' | '==' | '>=' | '>' | '!=';

/**
 * All Firestore array comparison operators.
 */
export type WhereFilterOpArrayValue = 'array-contains' | 'array-contains-any' | 'in' | 'not-in';

/**
 * https://firebase.google.com/docs/firestore/query-data/queries#query_operators
 */
export type WhereFilterOp = WhereFilterOpValue | WhereFilterOpArrayValue;

/**
 * Maximum number of arguments allowed with the "in" and "array-contains"/"array-contains-any" operators.
 */
export const FIRESTORE_MAX_WHERE_IN_FILTER_ARGS_COUNT = 10;

/**
 * Configuration data for a where constraint.
 */
export interface WhereQueryConstraintData {
  /**
   * Field path to filter on
   */
  readonly fieldPath: string | FieldPath;
  /**
   * Filter operator
   */
  readonly opStr: WhereFilterOp;
  /**
   * Value to compare against
   */
  readonly value: unknown;
}

/**
 * Creates a constraint that filters documents by field values.
 *
 * See: https://firebase.google.com/docs/firestore/query-data/queries#simple_queries
 *
 * @template T - Type of object structure to create a typed field path from
 * @param fieldPath - Field path or string path to filter on
 * @param opStr - Filter operator
 * @param value - Value to compare against
 * @returns A Firestore query constraint for filtering documents
 */
export function where<T>(fieldPath: StringKeyPropertyKeys<T>, opStr: WhereFilterOp, value: unknown): FirestoreQueryConstraint<WhereQueryConstraintData>;
export function where(fieldPath: FieldPathOrStringPath, opStr: WhereFilterOp, value: unknown): FirestoreQueryConstraint<WhereQueryConstraintData>;
export function where<T = object>(fieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, opStr: WhereFilterOp, value: unknown): FirestoreQueryConstraint<WhereQueryConstraintData> {
  switch (opStr) {
    case 'array-contains':
      if (Array.isArray(value)) {
        throw new Error('array-contains does not accept array values. Did you mean "array-contains-any"?');
      }
      break;
    case 'in':
    case 'array-contains-any':
      if (value == null) {
        throw new Error(`"${opStr}" requires a non-null value.`);
      }

      // ensure the value is passed as an array.
      value = convertToArray(value);
      break;
  }

  return firestoreQueryConstraint(FIRESTORE_WHERE_QUERY_CONSTRAINT_TYPE, { fieldPath: fieldPath as string, opStr, value });
}

// MARK: WhereDocumentId
/**
 * Constraint type identifier for filtering documents by their document ID.
 */
export const FIRESTORE_WHERE_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE = 'where_doc_id';

/**
 * Configuration data for a whereDocumentId constraint.
 * Omits fieldPath since document ID is implied.
 */
export type WhereDocumentIdQueryConstraintData = Omit<WhereQueryConstraintData, 'fieldPath'>;

/**
 * Creates a constraint that filters documents by their document ID.
 *
 * @param opStr - Filter operator
 * @param value - Document ID value to compare against
 * @returns A Firestore query constraint for filtering documents by ID
 */
export function whereDocumentId(opStr: WhereFilterOp, value: unknown): FirestoreQueryConstraint<WhereDocumentIdQueryConstraintData> {
  return firestoreQueryConstraint(FIRESTORE_WHERE_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE, { opStr, value });
}

// MARK: OrderBy
/**
 * Constraint type identifier for ordering documents by field values.
 */
export const FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE = 'order_by';

/**
 * Direction for ordering query results (ascending or descending).
 */
export type OrderByDirection = SortingOrder;

/**
 * Configuration data for an orderBy constraint.
 */
export interface OrderByQueryConstraintData {
  /**
   * Field path to order by
   */
  readonly fieldPath: FieldPathOrStringPath;
  /**
   * Direction to order results (ascending or descending)
   */
  readonly directionStr?: OrderByDirection;
}

/**
 * Creates a constraint that orders documents by a field value.
 *
 * @template T - Type of object structure to create a typed field path from
 * @param fieldPath - Field path using property key of type T
 * @param directionStr - Direction to order results (defaults to ascending)
 * @returns A Firestore query constraint for ordering documents
 */
export function orderBy<T>(fieldPath: StringKeyPropertyKeys<T>, directionStr?: OrderByDirection): FirestoreQueryConstraint<OrderByQueryConstraintData>;
/**
 * Creates a constraint that orders documents by a field value.
 *
 * @param fieldPath - Field path or string path to order by
 * @param directionStr - Direction to order results (defaults to ascending)
 * @returns A Firestore query constraint for ordering documents
 */
export function orderBy(fieldPath: FieldPathOrStringPath, directionStr?: OrderByDirection): FirestoreQueryConstraint<OrderByQueryConstraintData>;
export function orderBy<T = object>(fieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, directionStr?: OrderByDirection): FirestoreQueryConstraint<OrderByQueryConstraintData> {
  return firestoreQueryConstraint(FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE, { fieldPath: fieldPath as FieldPathOrStringPath, directionStr });
}

// MARK: OrderByDocumentId
/**
 * Constraint type identifier for ordering documents by their document ID.
 */
export const FIRESTORE_ORDER_BY_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE = 'order_by_doc_id';

/**
 * Configuration data for an orderByDocumentId constraint.
 * Only includes direction since document ID is implied.
 */
export type OrderByDocumentIdQueryConstraintData = Pick<OrderByQueryConstraintData, 'directionStr'>;

/**
 * Creates a constraint that orders documents by their document ID.
 *
 * @param directionStr - Direction to order results (defaults to ascending)
 * @returns A Firestore query constraint for ordering documents by ID
 */
export function orderByDocumentId(directionStr?: OrderByDirection): FirestoreQueryConstraint<OrderByDocumentIdQueryConstraintData> {
  return firestoreQueryConstraint(FIRESTORE_ORDER_BY_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE, { directionStr });
}

// MARK: Start At
/**
 * Constraint type identifier for starting a query at a document snapshot.
 */
export const FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE = 'start_at';

/**
 * Configuration data for a startAt constraint using a document snapshot.
 *
 * @template T - Type of document data
 */
export interface StartAtQueryConstraintData<T = DocumentData> {
  /**
   * Document snapshot to start at
   */
  snapshot: DocumentSnapshot<T>;
}

/**
 * Creates a constraint that starts returning results at the document referenced by the snapshot.
 *
 * @template T - Type of document data
 * @param snapshot - Document snapshot to start at
 * @returns A Firestore query constraint for starting at a document
 */
export function startAt<T = DocumentData>(snapshot: DocumentSnapshot<T>): FirestoreQueryConstraint<StartAtQueryConstraintData<T>> {
  return firestoreQueryConstraint(FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE, { snapshot });
}

// MARK: Start At Value
/**
 * Constraint type identifier for starting a query at field values.
 */
export const FIRESTORE_START_AT_VALUE_QUERY_CONSTRAINT_TYPE = 'start_at_path';

/**
 * Configuration data for a startAtValue constraint using field values.
 */
export interface StartAtValueQueryConstraintData {
  /**
   * Field values to start at
   */
  readonly fieldValues: unknown[];
}

/**
 * Creates a constraint that starts returning results at the specified field values.
 *
 * @param fieldValues - Field values to start at (must match the orderBy fields)
 * @returns A Firestore query constraint for starting at field values
 */
export function startAtValue(...fieldValues: unknown[]): FirestoreQueryConstraint<StartAtValueQueryConstraintData> {
  return firestoreQueryConstraint(FIRESTORE_START_AT_VALUE_QUERY_CONSTRAINT_TYPE, { fieldValues });
}

// MARK: Start After
/**
 * Constraint type identifier for starting a query after a document snapshot.
 */
export const FIRESTORE_START_AFTER_QUERY_CONSTRAINT_TYPE = 'start_after';

/**
 * Configuration data for a startAfter constraint using a document snapshot.
 *
 * @template T - Type of document data
 */
export interface StartAfterQueryConstraintData<T = DocumentData> {
  /**
   * Document snapshot to start after
   */
  readonly snapshot: DocumentSnapshot<T>;
}

/**
 * Creates a constraint that starts returning results after the document referenced by the snapshot.
 *
 * @template T - Type of document data
 * @param snapshot - Document snapshot to start after
 * @returns A Firestore query constraint for starting after a document
 */
export function startAfter<T = DocumentData>(snapshot: DocumentSnapshot<T>): FirestoreQueryConstraint<StartAfterQueryConstraintData<T>> {
  return firestoreQueryConstraint(FIRESTORE_START_AFTER_QUERY_CONSTRAINT_TYPE, { snapshot });
}

// MARK: End At
/**
 * Constraint type identifier for ending a query at a document snapshot.
 */
export const FIRESTORE_END_AT_QUERY_CONSTRAINT_TYPE = 'end_at';

/**
 * Configuration data for an endAt constraint using a document snapshot.
 *
 * @template T - Type of document data
 */
export interface EndAtQueryConstraintData<T = DocumentData> {
  /**
   * Document snapshot to end at
   */
  readonly snapshot: DocumentSnapshot<T>;
}

// MARK: End At Value
/**
 * Constraint type identifier for ending a query at field values.
 */
export const FIRESTORE_END_AT_VALUE_QUERY_CONSTRAINT_TYPE = 'end_at_path';

/**
 * Configuration data for an endAtValue constraint using field values.
 */
export interface EndAtValueQueryConstraintData {
  /**
   * Field values to end at
   */
  readonly fieldValues: unknown[];
}

/**
 * Creates a constraint that ends results at the specified field values.
 *
 * @param fieldValues - Field values to end at (must match the orderBy fields)
 * @returns A Firestore query constraint for ending at field values
 */
export function endAtValue(...fieldValues: unknown[]): FirestoreQueryConstraint<EndAtValueQueryConstraintData> {
  return firestoreQueryConstraint(FIRESTORE_END_AT_VALUE_QUERY_CONSTRAINT_TYPE, { fieldValues });
}

/**
 * Creates a constraint that ends returning results at the document referenced by the snapshot.
 *
 * @template T - Type of document data
 * @param snapshot - Document snapshot to end at
 * @returns A Firestore query constraint for ending at a document
 */
export function endAt<T = DocumentData>(snapshot: DocumentSnapshot<T>): FirestoreQueryConstraint<EndAtQueryConstraintData<T>> {
  return firestoreQueryConstraint(FIRESTORE_END_AT_QUERY_CONSTRAINT_TYPE, { snapshot });
}

// MARK: End Before
/**
 * Constraint type identifier for ending a query before a document snapshot.
 */
export const FIRESTORE_END_BEFORE_QUERY_CONSTRAINT_TYPE = 'end_before';

/**
 * Configuration data for an endBefore constraint using a document snapshot.
 *
 * @template T - Type of document data
 */
export interface EndBeforeQueryConstraintData<T = DocumentData> {
  /**
   * Document snapshot to end before
   */
  readonly snapshot: DocumentSnapshot<T>;
}

/**
 * Creates a constraint that ends returning results before the document referenced by the snapshot.
 *
 * @template T - Type of document data
 * @param snapshot - Document snapshot to end before
 * @returns A Firestore query constraint for ending before a document
 */
export function endBefore<T = DocumentData>(snapshot: DocumentSnapshot<T>): FirestoreQueryConstraint<EndBeforeQueryConstraintData<T>> {
  return firestoreQueryConstraint(FIRESTORE_END_BEFORE_QUERY_CONSTRAINT_TYPE, { snapshot });
}

// MARK: Handler
/**
 * Updates the input builder with the passed constraint value.
 */
export type FirestoreQueryConstraintHandlerFunction<B, D = unknown> = (builder: B, data: D, constraint: FirestoreQueryConstraint<D>) => B;

/**
 * Map of constraint type identifiers to handler functions.
 *
 * @template B - Type of query builder
 */
export type FirestoreQueryConstraintHandlerMap<B> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly [key: string]: Maybe<FirestoreQueryConstraintHandlerFunction<B, any>>;
};

/**
 * The full list of known firestore query constraints, and the data associated with it.
 */
export type FullFirestoreQueryConstraintDataMapping = {
  [FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE]: LimitQueryConstraintData;
  [FIRESTORE_LIMIT_TO_LAST_QUERY_CONSTRAINT_TYPE]: LimitToLastQueryConstraintData;
  [FIRESTORE_WHERE_QUERY_CONSTRAINT_TYPE]: WhereQueryConstraintData;
  [FIRESTORE_WHERE_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE]: WhereDocumentIdQueryConstraintData;
  [FIRESTORE_OFFSET_QUERY_CONSTRAINT_TYPE]: OffsetQueryConstraintData;
  [FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE]: OrderByQueryConstraintData;
  [FIRESTORE_ORDER_BY_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE]: OrderByDocumentIdQueryConstraintData;
  [FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE]: StartAtQueryConstraintData;
  [FIRESTORE_START_AT_VALUE_QUERY_CONSTRAINT_TYPE]: StartAtValueQueryConstraintData;
  [FIRESTORE_START_AFTER_QUERY_CONSTRAINT_TYPE]: StartAfterQueryConstraintData;
  [FIRESTORE_END_AT_QUERY_CONSTRAINT_TYPE]: EndAtQueryConstraintData;
  [FIRESTORE_END_AT_VALUE_QUERY_CONSTRAINT_TYPE]: EndAtValueQueryConstraintData;
  [FIRESTORE_END_BEFORE_QUERY_CONSTRAINT_TYPE]: EndBeforeQueryConstraintData;
};

/**
 * Mapping of all constraint types to their constraint objects.
 */
export type FullFirestoreQueryConstraintMapping = {
  [K in keyof FullFirestoreQueryConstraintDataMapping]: FirestoreQueryConstraint<FullFirestoreQueryConstraintDataMapping[K]>;
};

/**
 * Mapping of all constraint types to their handler functions for a specific builder type.
 *
 * @template B - Type of query builder
 */
export type FullFirestoreQueryConstraintHandlersMapping<B> = {
  [K in keyof FullFirestoreQueryConstraintMapping]: Maybe<FirestoreQueryConstraintHandlerFunction<B, FullFirestoreQueryConstraintDataMapping[K]>>;
};

// MARK: Utils
/**
 * Creates a function that adds or replaces limit constraints in a list of constraints.
 *
 * @param limit - Maximum number of documents to return
 * @param addedLimitType - Type of limit constraint to add (default: regular limit)
 * @returns A function that adds or replaces limit constraints
 */
export function addOrReplaceLimitInConstraints(limit: number, addedLimitType: typeof FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE | typeof FIRESTORE_LIMIT_TO_LAST_QUERY_CONSTRAINT_TYPE = FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE): (constraints: FirestoreQueryConstraint[]) => FirestoreQueryConstraint[] {
  const replace = replaceConstraints(
    (constraints) => {
      let type: FirestoreQueryConstraintType;

      if (constraints.length) {
        type = constraints[0].type;
      } else {
        type = addedLimitType;
      }

      return {
        type,
        data: {
          limit
        } as LimitQueryConstraintData | LimitToLastQueryConstraintData
      };
    },
    [FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE, FIRESTORE_LIMIT_TO_LAST_QUERY_CONSTRAINT_TYPE]
  );

  return replace;
}

/**
 * Function type for transforming a list of query constraints into another list of constraints.
 */
export type FirestoreQueryConstraintMapFunction = (constraints: FirestoreQueryConstraint[]) => FirestoreQueryConstraint[];

/**
 * Creates a function that filters out constraints of specific types.
 *
 * @param types - Constraint types to filter out
 * @returns A function that filters constraints by type
 */
export function filterConstraintsOfType(...types: FirestoreQueryConstraintType[]): FirestoreQueryConstraintMapFunction {
  const typesToFilterOut = new Set(types);
  return (constraints) => constraints.filter((x) => !typesToFilterOut.has(x.type));
}

/**
 * Creates a function that replaces constraints of specific types with new constraints.
 *
 * @param replaceFn - Function that generates replacement constraints
 * @param types - Constraint types to replace
 * @returns A function that replaces constraints of specified types
 */
export function replaceConstraints(replaceFn: (constraints: FirestoreQueryConstraint[]) => Maybe<ArrayOrValue<FirestoreQueryConstraint>>, types: FirestoreQueryConstraintType[]): (constraints: FirestoreQueryConstraint[]) => FirestoreQueryConstraint[] {
  const separateFn = separateConstraints(...types);

  return (constraints) => {
    const separated = separateFn(constraints);
    const replacements = asArray(replaceFn(separated.excluded));
    return replacements ? pushItemOrArrayItemsIntoArray(separated.included, replacements) : separated.included;
  };
}

/**
 * Creates a function that separates constraints of specific types from others.
 *
 * @param types - Constraint types to separate
 * @returns A function that separates constraints into included and excluded groups
 */
export function separateConstraints(...types: FirestoreQueryConstraintType[]): (constraints: FirestoreQueryConstraint[]) => SeparateResult<FirestoreQueryConstraint> {
  return (constraints) => {
    const typesToFilterOut = new Set(types);
    const separated = separateValues(constraints, (x) => !typesToFilterOut.has(x.type));
    return separated;
  };
}
