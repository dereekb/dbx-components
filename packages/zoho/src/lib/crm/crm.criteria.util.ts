import { type ArrayOrValue, type EmailAddress, type PrimativeKey, asArray } from '@dereekb/util';
import { type ZohoCrmSearchRecordsCriteriaEntry, type ZohoCrmSearchRecordsCriteriaEntryArray } from './crm.criteria';

/**
 * Creates a ZohoCrmSearchRecordsCriteriaEntryArray from an array of emails.
 *
 * @param emails Email or array of emails to search for.
 * @param field Optional field name to use. Defaults to 'Email'.
 * @returns Array of ZohoCrmSearchRecordsCriteriaEntry
 */
export function zohoCrmSearchRecordsCriteriaEntriesForEmails<T = any>(emails: ArrayOrValue<EmailAddress>, field: keyof T extends PrimativeKey ? PrimativeKey & keyof T : PrimativeKey = 'Email' as any): ZohoCrmSearchRecordsCriteriaEntryArray<T> {
  const allEmails = asArray(emails);
  return allEmails.map((email) => {
    const emailCriteria: ZohoCrmSearchRecordsCriteriaEntry<T> = {
      field,
      filter: 'equals',
      value: email
    };

    return emailCriteria;
  });
}
