import { textAreaField, textField } from "@dereekb/dbx-form";
import { GUESTBOOK_ENTRY_MESSAGE_MAX_LENGTH, GUESTBOOK_ENTRY_SIGNED_MAX_LENGTH } from "@dereekb/demo-firebase";

export function guestbookEntryFields() {
  return [
    guestbookEntryMessageField(),
    guestbookEntrySignedField()
  ];
}

export function guestbookEntryMessageField() {
  return textAreaField({ key: 'message', label: 'Message', maxLength: GUESTBOOK_ENTRY_MESSAGE_MAX_LENGTH, required: true });
}

export function guestbookEntrySignedField() {
  return textField({ key: 'signed', label: 'Signed', maxLength: GUESTBOOK_ENTRY_SIGNED_MAX_LENGTH, required: true });
}
