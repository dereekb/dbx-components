import { type EmailAddress } from '@dereekb/util';
import { type FirestoreModelId } from './collection';

/**
 * Creates a valid FirestoreModelId from an email address.
 *
 * @param emailAddress
 * @returns
 */
export function firestoreModelIdFromEmail(emailAddress: EmailAddress): FirestoreModelId {
  return emailAddress.replace('@', 'AAA').replace(/[^a-zA-Z0-9]/g, '');
}
