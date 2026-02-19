import { type ArrayOrValue, type EmailAddress, type PrimativeKey, asArray } from '@dereekb/util';
import { type ZohoSearchRecordsCriteriaEntryArray, type ZohoSearchRecordsCriteriaEntry } from './criteria';

/**
 * Creates a ZohoSearchRecordsCriteriaEntryArray from an array of emails.
 *
 * @param emails Email or array of emails to search for.
 * @param field Optional field name to use. Defaults to 'Email'.
 * @returns Array of ZohoSearchRecordsCriteriaEntry
 */
export function zohoSearchRecordsCriteriaEntriesForEmails<T = any>(emails: ArrayOrValue<EmailAddress>, field: keyof T extends PrimativeKey ? PrimativeKey & keyof T : PrimativeKey = 'Email' as any): ZohoSearchRecordsCriteriaEntryArray<T> {
  const allEmails = asArray(emails);
  return allEmails.map((email) => {
    const emailCriteria: ZohoSearchRecordsCriteriaEntry<T> = {
      field,
      filter: 'equals',
      value: email
    };

    return emailCriteria;
  });
}
