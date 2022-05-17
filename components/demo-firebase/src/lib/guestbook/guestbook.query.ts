import { FirestoreQueryConstraint, where } from "@dereekb/firebase";

export function publishedGuestbook(published = true): FirestoreQueryConstraint {
  return where('published', '==', published);
}

export function publishedGuestbookEntry(published = true): FirestoreQueryConstraint {
  return where('published', '==', published);
}
