import { Maybe, ObjectMap } from '@dereekb/util';
import { DocumentSnapshot, DocumentData } from '../types';

/**
 * A constraint. Used by drivers to apply native firebase query constraints.
 */
export interface FirestoreQueryConstraint<T = any> {
  type: string;
  data: T;
}

// MARK: Limit
export const FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE = 'limit';

export interface LimitQueryConstraintData {
  limit: number;
}

export function limit(limit: number): FirestoreQueryConstraint<LimitQueryConstraintData> {
  return {
    type: FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE,
    data: {
      limit
    }
  };
}

// MARK: Start At
export const FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE = 'start_at';

export interface StartAtQueryConstraintData<T = DocumentData> {
  snapshot: DocumentSnapshot<T>;
}

export function startAt<T = DocumentData>(snapshot: DocumentSnapshot<T>): FirestoreQueryConstraint<StartAtQueryConstraintData<T>> {
  return {
    type: FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE,
    data: {
      snapshot
    }
  };
}

// MARK: Handler
/**
 * Updates the input builder with the passed constraint value.
 */
export type FirestoreQueryConstraintHandlerFunction<B, D = any> = (builder: B, data: D, constraint: FirestoreQueryConstraint<D>) => B;

export type FirestoreQueryConstraintHandlerMap<B> = ObjectMap<Maybe<FirestoreQueryConstraintHandlerFunction<B>>>;

export type FullFirestoreQueryConstraintDataMapping = {
  [FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE]: LimitQueryConstraintData,
  [FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE]: StartAtQueryConstraintData
}

export type FullFirestoreQueryConstraintMapping = {
  [K in keyof FullFirestoreQueryConstraintDataMapping]: FirestoreQueryConstraint<FullFirestoreQueryConstraintDataMapping[K]>;
}

export type FullFirestoreQueryConstraintHandlersMapping<B> = {
  [K in keyof FullFirestoreQueryConstraintMapping]: Maybe<FirestoreQueryConstraintHandlerFunction<B, FullFirestoreQueryConstraintDataMapping[K]>>;
}
