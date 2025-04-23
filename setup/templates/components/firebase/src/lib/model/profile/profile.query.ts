import { FirestoreQueryConstraint, where } from '@dereekb/firebase';

export function profileWithUsername(username: string): FirestoreQueryConstraint {
  return where('username', '==', username);
}
