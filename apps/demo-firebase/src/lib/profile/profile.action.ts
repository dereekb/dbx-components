import { AsyncFirebaseFunctionUpdateAction, FirebaseFunctionUpdateAction } from "@dereekb/firebase";
import { ProfileDocument, ProfileFirestoreCollection } from "./profile";

export type ProfileUpdateAction = FirebaseFunctionUpdateAction<ProfileDocument>;
export type AsyncProfileUpdateAction = AsyncFirebaseFunctionUpdateAction<ProfileDocument>;

export abstract class ProfileActions { }

export function profileActions(firestoreCollection: ProfileFirestoreCollection): ProfileActions {
  const { query } = firestoreCollection;
  return {};
}
