import { type ArrayOrValue, type EmailAddress, type PrimativeKey, asArray } from '@dereekb/util';
import { type ZohoSearchRecordsCriteriaEntryArray, type ZohoSearchRecordsCriteriaEntry } from './criteria';

/**
 * Creates a {@link ZohoSearchRecordsCriteriaEntryArray} with an `equals` filter for each email address.
 *
 * When used within an OR criteria tree, this enables searching for records matching any of the provided emails.
 *
 * @param emails - Single email or array of emails to create criteria entries for
 * @param field - Record field name to match against. Defaults to `'Email'`.
 * @returns Array of criteria entries, one per email, each using the `equals` filter
 *
 * @example
 * ```typescript
 * // Single email:
 * const criteria = zohoSearchRecordsCriteriaEntriesForEmails('jane@example.com');
 * // => [{ field: 'Email', filter: 'equals', value: 'jane@example.com' }]
 *
 * // Multiple emails with a custom field:
 * const criteria = zohoSearchRecordsCriteriaEntriesForEmails(
 *   ['jane@example.com', 'john@example.com'],
 *   'Secondary_Email'
 * );
 * ```
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
