import { FirestoreQueryConstraint, where } from "@dereekb/firebase";

export function profileWithUid(uid: string): FirestoreQueryConstraint {
  return where('uid', '==', uid);
}

export function profileWithUsername(username: string): FirestoreQueryConstraint {
  return where('username', '==', username);
}
