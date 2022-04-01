import { FirestoreQueryConstraint, where } from "@dereekb/firebase";

export interface ProfileQuery { }

export interface ProfileWithUsernameQuery extends ProfileQuery {
  username: string;
}

export function profileWithUsername({ username }: ProfileWithUsernameQuery): FirestoreQueryConstraint[] {
  return [where('username', '==', username)];
}
