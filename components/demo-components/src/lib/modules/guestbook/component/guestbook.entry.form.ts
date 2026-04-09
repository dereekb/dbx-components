import { textAreaField, textField, toggleField } from '@dereekb/dbx-form';
import { GUESTBOOK_ENTRY_MESSAGE_MAX_LENGTH, GUESTBOOK_ENTRY_SIGNED_MAX_LENGTH } from 'demo-firebase';

/**
 * Returns all form fields for a guestbook entry: message, signed, and published.
 *
 * @returns array of formly field configurations for guestbook entry editing
 */
export function guestbookEntryFields() {
  return [guestbookEntryMessageField(), guestbookEntrySignedField(), guestbookEntryPublishedField()];
}

/**
 * Creates a text area field for the guestbook entry message, enforcing the max length constraint.
 *
 * @returns a formly text area field configuration for the entry message
 */
export function guestbookEntryMessageField() {
  return textAreaField({ key: 'message', label: 'Message', maxLength: GUESTBOOK_ENTRY_MESSAGE_MAX_LENGTH, required: true });
}

/**
 * Creates a text field for the guestbook entry signature, enforcing the max length constraint.
 *
 * @returns a formly text field configuration for the signer name
 */
export function guestbookEntrySignedField() {
  return textField({ key: 'signed', label: 'Signed', maxLength: GUESTBOOK_ENTRY_SIGNED_MAX_LENGTH, required: true });
}

/**
 * Creates a toggle field controlling whether the guestbook entry is publicly visible.
 *
 * @returns a formly toggle field configuration for the published state
 */
export function guestbookEntryPublishedField() {
  return toggleField({ key: 'published', label: 'Public', description: 'If the message shows up in the guestbook publically or not.' });
}
