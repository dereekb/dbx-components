import { FirestoreQueryConstraint, where } from "@dereekb/firebase";

export function publishedGuestbookEntries(published = true): FirestoreQueryConstraint {
  return where('published', '==', published);
}
