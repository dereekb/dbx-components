import { AsyncFirebaseFunctionParsedUpdateAction, FirebaseFunctionParsedUpdateAction } from "@dereekb/firebase";
import { ProfileDocument, ProfileFirestoreCollection } from "./profile";

export type ProfileUpdateAction<P> = FirebaseFunctionParsedUpdateAction<P, ProfileDocument>;
export type AsyncProfileUpdateAction<P> = AsyncFirebaseFunctionParsedUpdateAction<P, ProfileDocument>;

export abstract class ProfileActions { }

export function profileActions(firestoreCollection: ProfileFirestoreCollection): ProfileActions {
  const { query } = firestoreCollection;
  return {};
}
