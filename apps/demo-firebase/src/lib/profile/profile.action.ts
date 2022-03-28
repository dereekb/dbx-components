import { collection } from 'firebase/firestore';
import { FirestoreCollectionReference } from "@dereekb/firebase";
import { Profile, ProfileRef } from "./profile";
import { queryProfileWithUsername } from "./profile.query";

export interface ProfileAction extends FirestoreCollectionReference<Profile> { }

export interface SetProfileUsername extends ProfileAction {
  username: string;
}

export function setProfileUsername(config: SetProfileUsername): Promise<Profile> {
  
  // todo: use functions

  return Promise.reject();
}
