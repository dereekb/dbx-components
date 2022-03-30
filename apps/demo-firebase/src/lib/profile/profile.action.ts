import { FirestoreCollectionReference } from "@dereekb/firebase";
import { Profile } from "./profile";

export interface SetProfileUsername {
  username: string;
}

export function setProfileUsername(config: SetProfileUsername): Promise<Profile> {

  // todo: use functions

  return Promise.reject();
}
