import { AsyncFirebaseFunctionUpdateAction, FirebaseFunctionUpdateAction } from "@dereekb/firebase";
import { ProfileDocument, ProfileFirestoreCollection } from "./profile";

export type ProfileUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, ProfileDocument>;
export type AsyncProfileUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, ProfileDocument>;

export abstract class ProfileActions { }

export function profileActions(firestoreCollection: ProfileFirestoreCollection): ProfileActions {
  const { query } = firestoreCollection;
  return {};
}
