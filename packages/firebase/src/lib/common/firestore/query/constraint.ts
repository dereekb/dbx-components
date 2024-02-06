import { type FieldPathOrStringPath, type FieldPathOrStringPathOf } from './../types';
import { type ArrayOrValue, asArray, pushItemOrArrayItemsIntoArray, type SeparateResult, separateValues, type SortingOrder, type Maybe, type StringKeyPropertyKeys, convertToArray } from '@dereekb/util';
import { type DocumentSnapshot, type DocumentData, type FieldPath } from '../types';

export type FirestoreQueryConstraintType = string;

/**
 * A constraint. Used by drivers to apply native firebase query constraints.
 */
export interface FirestoreQueryConstraint<T = unknown> {
  type: FirestoreQueryConstraintType;
  data: T;
}

export function firestoreQueryConstraint<T = unknown>(type: string, data: T): FirestoreQueryConstraint<T> {
  return {
    type,
    data
  };
}

export function firestoreQueryConstraintFactory(type: string): <T = unknown>(data: T) => FirestoreQueryConstraint<T> {
  return <T>(data: T) => firestoreQueryConstraint(type, data);
}

// MARK: Limit
export const FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE = 'limit';

export interface LimitQueryConstraintData {
  limit: number;
}

/**
 * Limits the maximum number of documents to return.
 *
 * @param limit
 * @returns
 */
export function limit(limit: number): FirestoreQueryConstraint<LimitQueryConstraintData> {
  return firestoreQueryConstraint(FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE, { limit });
}

// MARK: Limit To Last
export const FIRESTORE_LIMIT_TO_LAST_QUERY_CONSTRAINT_TYPE = 'limit_to_last';

export interface LimitToLastQueryConstraintData {
  limit: number;
}

/**
 * Returns the last matching documents in the query, up to the limit.
 *
 * Does not work with queries with streamed results.
 */
export function limitToLast(limit: number): FirestoreQueryConstraint<LimitToLastQueryConstraintData> {
  return firestoreQueryConstraint(FIRESTORE_LIMIT_TO_LAST_QUERY_CONSTRAINT_TYPE, { limit });
}

// MARK: Offset
export const FIRESTORE_OFFSET_QUERY_CONSTRAINT_TYPE = 'offset';

export interface OffsetQueryConstraintData {
  offset: number;
}

export function offset(offset: number): FirestoreQueryConstraint<OffsetQueryConstraintData> {
  return firestoreQueryConstraint(FIRESTORE_OFFSET_QUERY_CONSTRAINT_TYPE, { offset });
}

// MARK: Where
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

export interface WhereQueryConstraintData {
  fieldPath: string | FieldPath;
  opStr: WhereFilterOp;
  value: unknown;
}

/**
 * Configures a Firebase where query.
 *
 * https://firebase.google.com/docs/firestore/query-data/queries#simple_queries
 *
 * @param fieldPath
 * @param opStr
 * @param value
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
export const FIRESTORE_WHERE_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE = 'where_doc_id';

export type WhereDocumentIdQueryConstraintData = Omit<WhereQueryConstraintData, 'fieldPath'>;

export function whereDocumentId(opStr: WhereFilterOp, value: unknown): FirestoreQueryConstraint<WhereDocumentIdQueryConstraintData> {
  return firestoreQueryConstraint(FIRESTORE_WHERE_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE, { opStr, value });
}

// MARK: OrderBy
export const FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE = 'order_by';

export type OrderByDirection = SortingOrder;

export interface OrderByQueryConstraintData {
  fieldPath: FieldPathOrStringPath;
  directionStr?: OrderByDirection;
}

export function orderBy<T>(fieldPath: StringKeyPropertyKeys<T>, directionStr?: OrderByDirection): FirestoreQueryConstraint<OrderByQueryConstraintData>;
export function orderBy(fieldPath: FieldPathOrStringPath, directionStr?: OrderByDirection): FirestoreQueryConstraint<OrderByQueryConstraintData>;
export function orderBy<T = object>(fieldPath: FieldPathOrStringPathOf<T> | FieldPathOrStringPath, directionStr?: OrderByDirection): FirestoreQueryConstraint<OrderByQueryConstraintData> {
  return firestoreQueryConstraint(FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE, { fieldPath: fieldPath as FieldPathOrStringPath, directionStr });
}

// MARK: OrderByDocumentId
export const FIRESTORE_ORDER_BY_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE = 'order_by_doc_id';

export type OrderByDocumentIdQueryConstraintData = Pick<OrderByQueryConstraintData, 'directionStr'>;

export function orderByDocumentId(directionStr?: OrderByDirection): FirestoreQueryConstraint<OrderByDocumentIdQueryConstraintData> {
  return firestoreQueryConstraint(FIRESTORE_ORDER_BY_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE, { directionStr });
}

// MARK: Start At
export const FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE = 'start_at';

export interface StartAtQueryConstraintData<T = DocumentData> {
  snapshot: DocumentSnapshot<T>;
}

export function startAt<T = DocumentData>(snapshot: DocumentSnapshot<T>): FirestoreQueryConstraint<StartAtQueryConstraintData<T>> {
  return firestoreQueryConstraint(FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE, { snapshot });
}

// MARK: Start At Value
export const FIRESTORE_START_AT_VALUE_QUERY_CONSTRAINT_TYPE = 'start_at_path';

export interface StartAtValueQueryConstraintData {
  fieldValues: unknown[];
}

export function startAtValue(...fieldValues: unknown[]): FirestoreQueryConstraint<StartAtValueQueryConstraintData> {
  return firestoreQueryConstraint(FIRESTORE_START_AT_VALUE_QUERY_CONSTRAINT_TYPE, { fieldValues });
}

// MARK: Start After
export const FIRESTORE_START_AFTER_QUERY_CONSTRAINT_TYPE = 'start_after';

export interface StartAfterQueryConstraintData<T = DocumentData> {
  snapshot: DocumentSnapshot<T>;
}

export function startAfter<T = DocumentData>(snapshot: DocumentSnapshot<T>): FirestoreQueryConstraint<StartAfterQueryConstraintData<T>> {
  return firestoreQueryConstraint(FIRESTORE_START_AFTER_QUERY_CONSTRAINT_TYPE, { snapshot });
}

// MARK: End At
export const FIRESTORE_END_AT_QUERY_CONSTRAINT_TYPE = 'end_at';

export interface EndAtQueryConstraintData<T = DocumentData> {
  snapshot: DocumentSnapshot<T>;
}

// MARK: End At Value
export const FIRESTORE_END_AT_VALUE_QUERY_CONSTRAINT_TYPE = 'end_at_path';

export interface EndAtValueQueryConstraintData {
  fieldValues: unknown[];
}

export function endAtValue(...fieldValues: unknown[]): FirestoreQueryConstraint<EndAtValueQueryConstraintData> {
  return firestoreQueryConstraint(FIRESTORE_END_AT_VALUE_QUERY_CONSTRAINT_TYPE, { fieldValues });
}

/**
 *
 * @param snapshot
 * @returns
 */
export function endAt<T = DocumentData>(snapshot: DocumentSnapshot<T>): FirestoreQueryConstraint<EndAtQueryConstraintData<T>> {
  return firestoreQueryConstraint(FIRESTORE_END_AT_QUERY_CONSTRAINT_TYPE, { snapshot });
}

// MARK: End Before
export const FIRESTORE_END_BEFORE_QUERY_CONSTRAINT_TYPE = 'end_before';

export interface EndBeforeQueryConstraintData<T = DocumentData> {
  snapshot: DocumentSnapshot<T>;
}

/**
 *
 * @param snapshot
 * @returns
 */
export function endBefore<T = DocumentData>(snapshot: DocumentSnapshot<T>): FirestoreQueryConstraint<EndBeforeQueryConstraintData<T>> {
  return firestoreQueryConstraint(FIRESTORE_END_BEFORE_QUERY_CONSTRAINT_TYPE, { snapshot });
}

// MARK: Handler
/**
 * Updates the input builder with the passed constraint value.
 */
export type FirestoreQueryConstraintHandlerFunction<B, D = unknown> = (builder: B, data: D, constraint: FirestoreQueryConstraint<D>) => B;

export type FirestoreQueryConstraintHandlerMap<B> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: Maybe<FirestoreQueryConstraintHandlerFunction<B, any>>;
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

export type FullFirestoreQueryConstraintMapping = {
  [K in keyof FullFirestoreQueryConstraintDataMapping]: FirestoreQueryConstraint<FullFirestoreQueryConstraintDataMapping[K]>;
};

export type FullFirestoreQueryConstraintHandlersMapping<B> = {
  [K in keyof FullFirestoreQueryConstraintMapping]: Maybe<FirestoreQueryConstraintHandlerFunction<B, FullFirestoreQueryConstraintDataMapping[K]>>;
};

// MARK: Utils
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

export type FirestoreQueryConstraintMapFunction = (constraints: FirestoreQueryConstraint[]) => FirestoreQueryConstraint[];

export function filterConstraintsOfType(...types: FirestoreQueryConstraintType[]): FirestoreQueryConstraintMapFunction {
  const typesToFilterOut = new Set(types);
  return (constraints) => constraints.filter((x) => !typesToFilterOut.has(x.type));
}

export function replaceConstraints(replaceFn: (constraints: FirestoreQueryConstraint[]) => Maybe<ArrayOrValue<FirestoreQueryConstraint>>, types: FirestoreQueryConstraintType[]): (constraints: FirestoreQueryConstraint[]) => FirestoreQueryConstraint[] {
  const separateFn = separateConstraints(...types);

  return (constraints) => {
    const separated = separateFn(constraints);
    const replacements = asArray(replaceFn(separated.excluded));
    return replacements ? pushItemOrArrayItemsIntoArray(separated.included, replacements) : separated.included;
  };
}

export function separateConstraints(...types: FirestoreQueryConstraintType[]): (constraints: FirestoreQueryConstraint[]) => SeparateResult<FirestoreQueryConstraint> {
  return (constraints) => {
    const typesToFilterOut = new Set(types);
    const separated = separateValues(constraints, (x) => !typesToFilterOut.has(x.type));
    return separated;
  };
}
