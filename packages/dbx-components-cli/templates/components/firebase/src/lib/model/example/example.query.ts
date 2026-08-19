import { type FirestoreQueryConstraint, where } from '@dereekb/firebase';

/**
 * Params for {@link exampleWithUsernameQuery}.
 */
export interface ExampleWithUsernameQueryParams {
  /**
   * The username to match.
   */
  readonly username: string;
}

/**
 * Query for the example holding a given unique username.
 *
 * @param params - The username to match.
 * @returns Firestore query constraints matching that username.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Example
 * @dbxModelFirebaseIndexScope COLLECTION
 * @dbxModelFirebaseIndexCategory lookup
 */
export function exampleWithUsernameQuery(params: ExampleWithUsernameQueryParams): FirestoreQueryConstraint[] {
  return [where('username', '==', params.username)];
}
