import { ArrayOrValue, asArray, mergeArrayOrValueIntoArray, SeparateResult, separateValues } from '@dereekb/util';
import { SortingOrder, Maybe, ObjectMap } from '@dereekb/util';
import { DocumentSnapshot, DocumentData, FieldPath } from '../types';

export type FirestoreQueryConstraintType = string;

/**
 * A constraint. Used by drivers to apply native firebase query constraints.
 */
export interface FirestoreQueryConstraint<T = unknown> {
  type: FirestoreQueryConstraintType;
  data: T;
}

export function firestoreQueryConstraint<T>(type: string, data: T): FirestoreQueryConstraint<T> {
  return {
    type,
    data
  };
}

export function firestoreQueryConstraintFactory(type: string): <T>(data: T) => FirestoreQueryConstraint<T> {
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

export type WhereFilterOp = '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in' | 'not-in'; // 'array-contains-unknown' is not supported by firebase-server

export interface WhereQueryConstraintData {
  fieldPath: string | FieldPath;
  opStr: WhereFilterOp;
  value: unknown;
}

export function where<T>(fieldPath: keyof T, opStr: WhereFilterOp, value: unknown): FirestoreQueryConstraint<WhereQueryConstraintData>;
export function where(fieldPath: string | FieldPath, opStr: WhereFilterOp, value: unknown): FirestoreQueryConstraint<WhereQueryConstraintData>
export function where(fieldPath: unknown, opStr: WhereFilterOp, value: unknown): FirestoreQueryConstraint<WhereQueryConstraintData> {
  return firestoreQueryConstraint(FIRESTORE_WHERE_QUERY_CONSTRAINT_TYPE, { fieldPath: (fieldPath as string), opStr, value });
}

// MARK: OrderBy
export const FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE = 'order_by';

export type OrderByDirection = SortingOrder;

export interface OrderByQueryConstraintData {
  fieldPath: string | FieldPath;
  directionStr?: OrderByDirection;
}

export function orderBy(fieldPath: string | FieldPath, directionStr?: OrderByDirection): FirestoreQueryConstraint<OrderByQueryConstraintData> {
  return firestoreQueryConstraint(FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE, { fieldPath, directionStr });
}

// MARK: Start At
export const FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE = 'start_at';

export interface StartAtQueryConstraintData<T = DocumentData> {
  snapshot: DocumentSnapshot<T>;
}

export function startAt<T = DocumentData>(snapshot: DocumentSnapshot<T>): FirestoreQueryConstraint<StartAtQueryConstraintData<T>> {
  return firestoreQueryConstraint(FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE, { snapshot });
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
  [key: string]: Maybe<FirestoreQueryConstraintHandlerFunction<B, any>>
};

/**
 * The full list of known firestore query constraints, and the data associated with it.
 */
export type FullFirestoreQueryConstraintDataMapping = {
  [FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE]: LimitQueryConstraintData,
  [FIRESTORE_LIMIT_TO_LAST_QUERY_CONSTRAINT_TYPE]: LimitToLastQueryConstraintData,
  [FIRESTORE_WHERE_QUERY_CONSTRAINT_TYPE]: WhereQueryConstraintData,
  [FIRESTORE_OFFSET_QUERY_CONSTRAINT_TYPE]: OffsetQueryConstraintData,
  [FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE]: OrderByQueryConstraintData,
  [FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE]: StartAtQueryConstraintData,
  [FIRESTORE_START_AFTER_QUERY_CONSTRAINT_TYPE]: StartAfterQueryConstraintData,
  [FIRESTORE_END_AT_QUERY_CONSTRAINT_TYPE]: EndAtQueryConstraintData,
  [FIRESTORE_END_BEFORE_QUERY_CONSTRAINT_TYPE]: EndBeforeQueryConstraintData
};

export type FullFirestoreQueryConstraintMapping = {
  [K in keyof FullFirestoreQueryConstraintDataMapping]: FirestoreQueryConstraint<FullFirestoreQueryConstraintDataMapping[K]>;
};

export type FullFirestoreQueryConstraintHandlersMapping<B> = {
  [K in keyof FullFirestoreQueryConstraintMapping]: Maybe<FirestoreQueryConstraintHandlerFunction<B, FullFirestoreQueryConstraintDataMapping[K]>>;
};

// MARK: Utils
export function addOrReplaceLimitInConstraints(limit: number, addedLimitType: (typeof FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE | typeof FIRESTORE_LIMIT_TO_LAST_QUERY_CONSTRAINT_TYPE) = FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE): (constraints: FirestoreQueryConstraint[]) => FirestoreQueryConstraint[] {
  const replace = replaceConstraints((constraints) => {
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
  }, [FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE, FIRESTORE_LIMIT_TO_LAST_QUERY_CONSTRAINT_TYPE]);

  return replace;
}

export type FirestoreQueryConstraintMapFunction = (constraints: FirestoreQueryConstraint[]) => FirestoreQueryConstraint[];

export function filterConstraintsOfType(...types: FirestoreQueryConstraintType[]): FirestoreQueryConstraintMapFunction {
  const typesToFilterOut = new Set(types);
  return (constraints) => constraints.filter(x => !typesToFilterOut.has(x.type));
}

export function replaceConstraints(replaceFn: (constraints: FirestoreQueryConstraint[]) => Maybe<ArrayOrValue<FirestoreQueryConstraint>>, types: FirestoreQueryConstraintType[]): (constraints: FirestoreQueryConstraint[]) => FirestoreQueryConstraint[] {
  const separateFn = separateConstraints(...types);

  return (constraints) => {
    const separated = separateFn(constraints);
    const replacements = asArray(replaceFn(separated.excluded));
    return (replacements) ? mergeArrayOrValueIntoArray(separated.included, replacements) : separated.included;
  };
}

export function separateConstraints(...types: FirestoreQueryConstraintType[]): (constraints: FirestoreQueryConstraint[]) => SeparateResult<FirestoreQueryConstraint> {
  return (constraints) => {
    const typesToFilterOut = new Set(types);
    const separated = separateValues(constraints, (x) => !typesToFilterOut.has(x.type));
    return separated;
  };
}
