import { type FirestoreQueryConstraint, where } from '@dereekb/firebase';

/**
 * Params for {@link profileWithUsernameQuery}.
 */
export interface ProfileWithUsernameQueryParams {
  /**
   * The username to match.
   */
  readonly username: string;
}

/**
 * Query for the profile holding a given unique username.
 *
 * @param params - The username to match.
 * @returns Firestore query constraints matching that username.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Profile
 * @dbxModelFirebaseIndexScope COLLECTION
 * @dbxModelFirebaseIndexCategory lookup
 */
export function profileWithUsernameQuery(params: ProfileWithUsernameQueryParams): FirestoreQueryConstraint[] {
  return [where('username', '==', params.username)];
}
