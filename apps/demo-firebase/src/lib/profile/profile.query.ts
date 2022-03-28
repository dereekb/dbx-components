import { Observable } from 'rxjs';
import { FirestoreCollectionReference } from "@dereekb/firebase";
import { query, where } from "firebase/firestore";
import { collectionData } from "rxfire/firestore";
import { Profile } from "./profile";

export interface ProfileQuery extends FirestoreCollectionReference<Profile> { }

export interface ProfileWithUsernameQuery extends ProfileQuery {
  username: string;
}

export function queryProfileWithUsername({ username, collection }: ProfileWithUsernameQuery): Observable<Profile[]> {
  return collectionData<Profile>(query<Profile>(collection, where('username', '==', username)));
}
