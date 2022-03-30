import { DocumentSnapshot, DocumentData } from '../types';

/**
 * A constraint. Used by drivers to apply native firebase query constraints.
 */
export interface FirestoreQueryConstraint<T = any> {
  type: string;
  data: T;
}

// MARK: Limit
export const LIMIT_QUERY_CONSTRAINT_TYPE = 'limit';

export interface LimitQueryConstraintData {
  limit: number;
}

export function limit(limit: number): FirestoreQueryConstraint<LimitQueryConstraintData> {
  return {
    type: LIMIT_QUERY_CONSTRAINT_TYPE,
    data: {
      limit
    }
  };
}

// MARK: Start At
export const START_AT_QUERY_CONSTRAINT_TYPE = 'start_at';

export interface StartAtQueryConstraintData<T = DocumentData> {
  snapshot: DocumentSnapshot<T>;
}

export function startAt<T = DocumentData>(snapshot: DocumentSnapshot<T>): FirestoreQueryConstraint<StartAtQueryConstraintData<T>> {
  return {
    type: START_AT_QUERY_CONSTRAINT_TYPE,
    data: {
      snapshot
    }
  };
}
