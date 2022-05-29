import { FirestoreQueryConstraint, where } from "@dereekb/firebase";

export function exampleWithUsername(username: string): FirestoreQueryConstraint {
  return where('username', '==', username);
}
