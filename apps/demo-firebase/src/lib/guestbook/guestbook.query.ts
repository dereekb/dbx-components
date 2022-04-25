import { FirestoreQueryConstraint, where } from "@dereekb/firebase";

export function guestbookEntryWithUsername(username: string): FirestoreQueryConstraint {
  return where('username', '==', username);
}
