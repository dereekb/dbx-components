import { type EmailAddress } from '@dereekb/util';
import { type FirestoreModelId } from './collection';

/**
 * Creates a valid FirestoreModelId from an email address.
 *
 * Replaces `@` with `AAA` and strips all non-alphanumeric characters, producing an ID
 * that satisfies Firestore's document ID constraints. This encoding is one-way; the
 * original email cannot be recovered from the result.
 *
 * @param emailAddress - The email address to convert
 * @returns A Firestore-safe document ID derived from the email
 *
 * @example
 * ```ts
 * const id = firestoreModelIdFromEmail('user@example.com');
 * // id === 'userAAAexamplecom'
 * ```
 */
export function firestoreModelIdFromEmail(emailAddress: EmailAddress): FirestoreModelId {
  return emailAddress.replace('@', 'AAA').replaceAll(/[^a-zA-Z0-9]/g, '');
}
