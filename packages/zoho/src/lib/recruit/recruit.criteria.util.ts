import { ArrayOrValue, EmailAddress, PrimativeKey , asArray } from '@dereekb/util';
import { ZohoRecruitSearchRecordsCriteriaEntry, ZohoRecruitSearchRecordsCriteriaEntryArray } from './recruit.criteria';

/**
 * Creates a ZohoRecruitSearchRecordsCriteriaEntryArray from an array of emails.
 *
 * @param emails Email or array of emails to search for.
 * @param field Optional field name to use. Defaults to 'Email'.
 * @returns Array of ZohoRecruitSearchRecordsCriteriaEntry
 */
export function zohoRecruitSearchRecordsCriteriaEntriesForEmails<T = any>(emails: ArrayOrValue<EmailAddress>, field: keyof T extends PrimativeKey ? PrimativeKey & keyof T : PrimativeKey = 'Email' as any): ZohoRecruitSearchRecordsCriteriaEntryArray<T> {
  const allEmails = asArray(emails);
  return allEmails.map((email) => {
    const emailCriteria: ZohoRecruitSearchRecordsCriteriaEntry<T> = {
      field,
      filter: 'equals',
      value: email
    };

    return emailCriteria;
  });
}
